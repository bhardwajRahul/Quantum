import Repository from '@models/repository';
import Deployment from '@models/deployment';
import DockerContainer from '@models/docker/container';
import DockerContainerService from '@services/docker/container';
import Github from '@services/github';
import sendEmail from '@services/sendEmail';
import logger from '@utilities/logger';
import { IJob } from '@typings/models/job';
import { emitDeploymentStatus } from '@services/orchestrator/events';
import { activityContextFromJob } from '@services/activity';

export const runLifecycle = async (job: IJob): Promise<void> => {
    const action = job.payload?.action as 'start' | 'stop' | 'restart';
    const repositoryId = job.target?.repository?.toString();
    if(!repositoryId){
        throw new Error('Lifecycle::Repository::Required');
    }

    const repository: any = await Repository.findById(repositoryId).populate({
        path: 'user',
        select: 'username email container',
        populate: { path: 'github', select: 'accessToken username' }
    });
    if(!repository){
        throw new Error('Lifecycle::Repository::NotFound');
    }

    const container = await DockerContainer.findOne({ repository: repository._id });
    if(!container){
        throw new Error('Lifecycle::Container::NotFound');
    }

    const containerService = new DockerContainerService(container);
    const source = new Github(repository.user, repository);
    const userId = repository.user?._id?.toString();

    if(repository.organization) job.target.organization = repository.organization;
    const act = activityContextFromJob(job);

    const currentDeploymentId = repository.deployments?.[repository.deployments.length - 1];
    const currentDeployment = currentDeploymentId
        ? await Deployment.findById(currentDeploymentId)
        : null;
    const githubDeploymentId = currentDeployment?.githubDeploymentId;

    if(currentDeployment){
        currentDeployment.status = 'queued';
        await currentDeployment.save();
    }
    if(githubDeploymentId){
        source.updateDeploymentStatus(githubDeploymentId, 'queued').catch(() => {});
    }
    emitDeploymentStatus(userId, { repositoryId, deploymentId: currentDeploymentId?.toString(), status: 'queued', jobId: job._id.toString() });

    try{
        act.progress(`${action} container`);
        switch(action){
            case 'restart':
                await containerService.restart();
                break;
            case 'stop':
                await containerService.stop();

                await DockerContainer.updateOne({ _id: container._id }, { desiredState: 'stopped' });
                break;
            case 'start':
                await DockerContainer.updateOne({ _id: container._id }, { desiredState: 'running' });
                await containerService.start();
                break;
            default:
                throw new Error('Lifecycle::Invalid::Action');
        }

        const finalStatus = action === 'stop' ? 'stopped' : 'success';
        const githubState = action === 'stop' ? 'inactive' : 'success';
        if(currentDeployment){
            currentDeployment.status = finalStatus as any;
            await currentDeployment.save();
        }
        if(githubDeploymentId){
            source.updateDeploymentStatus(githubDeploymentId, githubState as any).catch(() => {});
        }
        emitDeploymentStatus(userId, { repositoryId, deploymentId: currentDeploymentId?.toString(), status: finalStatus, jobId: job._id.toString() });
        act.success(`Container ${action} for "${repository.alias}" completed`);
        notify(repository, action);
    }catch(error){
        if(currentDeployment){
            currentDeployment.status = 'failure';
            await currentDeployment.save();
        }
        if(githubDeploymentId){
            source.updateDeploymentStatus(githubDeploymentId, 'failure').catch(() => {});
        }
        emitDeploymentStatus(userId, { repositoryId, deploymentId: currentDeploymentId?.toString(), status: 'failure', jobId: job._id.toString() });
        act.fail(`Container ${action} failed`, error);
        logger.error('@services/orchestrator/handlers/lifecycleHandler.ts (runLifecycle): ' + error);
        throw error;
    }
};

const notify = (repository: any, action: string): void => {
    const messages: Record<string, { subject: string; html: string }> = {
        restart: {
            subject: `You have successfully restarted "${repository.alias}"`,
            html: `Hello @${repository.user.username}, the container is currently restarting, the services will be redeployed and the installation, construction and execution commands will be executed.`
        },
        stop: {
            subject: `Container "${repository.alias}" shut down successfully.`,
            html: `Hi @${repository.user.username}, the container has been shut down successfully.`
        },
        start: {
            subject: `Starting and deploying "${repository.alias}"`,
            html: `Hi @${repository.user.username}, the construction commands will be executed to proceed with the deployment.`
        }
    };
    const message = messages[action];
    if(message && repository.user?.email){
        sendEmail({ to: repository.user.email, subject: message.subject, html: message.html }).catch(() => {});
    }
};

export default runLifecycle;
