import Repository from '@models/repository';
import Deployment from '@models/deployment';
import User from '@models/user';
import Github from '@services/github';
import DockerContainerService from '@services/docker/container';
import RepositoryHandler from '@services/repositoryHandler';
import sendEmail from '@services/sendEmail';
import logger from '@utilities/logger';
import { IJob } from '@typings/models/job';
import { ensureRepositoryInfra, ensureWebhook, populateRepository } from '@services/orchestrator/provision';
import { resolveStrategy } from '@services/build';
import { runBuild } from '@services/orchestrator/handlers/buildHandler';
import { getIngressLabels, ensureSubdomain } from '@services/ingress';
import { emitDeploymentStatus } from '@services/orchestrator/events';
import { activityContextFromJob } from '@services/activity';

export const runDeploy = async (job: IJob): Promise<void> => {
    const repositoryId = job.target?.repository?.toString();
    if(!repositoryId){
        throw new Error('Deploy::Repository::Required');
    }
    const reason = (job.payload?.reason as string) || 'manual';

    const repository: any = await populateRepository(repositoryId);
    if(!repository){
        throw new Error('Deploy::Repository::NotFound');
    }
    const githubUser = repository.user;
    const userId = githubUser?._id?.toString();

    if(repository.organization) job.target.organization = repository.organization;

    const act = activityContextFromJob(job);

    try{

    const container = await act.step('Provisioning infrastructure', () => ensureRepositoryInfra(repository));
    await act.step('Ensuring webhook', () => ensureWebhook(repository, githubUser));

    const source = new Github(githubUser, repository);
    const containerService = new DockerContainerService(container);

    emitDeploymentStatus(userId, { repositoryId, status: 'queued', jobId: job._id.toString() });

    if(reason === 'rollback'){
        const target: any = await Deployment.findOne({
            _id: job.payload?.rollbackTo, repository: repository._id
        }).select('artifact');
        const tag = target?.artifact?.tag;
        if(!tag){
            throw new Error('Deploy::Rollback::NoArtifact');
        }
        const extraLabels = await getIngressLabels(repository).catch(() => ({}));
        act.progress('Rolling back to previous artifact');
        await containerService.removeContainer();
        await containerService.createAndStartContainer({ imageOverride: tag, extraLabels });
        const rollbackTo = String(job.payload?.rollbackTo);

        await Deployment.updateOne(
            {
                repository: repository._id,
                _id: { $ne: job.payload?.rollbackTo },
                status: 'success'
            },
            { status: 'rolledback' }
        );

        emitDeploymentStatus(userId, { repositoryId, deploymentId: rollbackTo, status: 'rolledback', jobId: job._id.toString() });
        return;
    }

    try{
        await containerService.stop();
    }catch(error){
        logger.warn('@services/orchestrator/handlers/deployHandler.ts: stop before redeploy failed (continuing): ' + error);
    }
    if(container.storagePath){
        await Github.deleteLogAndDirectory('', container.storagePath);
    }

    if(reason !== 'rollback' && (job.attempts || 0) > 1 && job.target?.deployment){
        await Deployment.updateOne(
            { _id: job.target.deployment, status: { $in: ['queued', 'building', 'pending'] } },
            { status: 'failure' }
        ).catch(() => {});
    }
    const deployment = await act.step('Cloning source & creating release', () => source.deployRepository());
    const deploymentId = deployment._id.toString();
    job.target.deployment = deployment._id as any;
    job.logRef = `${userId}:${container._id.toString()}`;

    if(repository.project) job.target.project = repository.project;
    if(repository.environment) job.target.environment = repository.environment;
    await job.save();

    await Promise.all([
        User.updateOne({ _id: userId }, { $addToSet: { deployments: deployment._id } }),
        Repository.updateOne({ _id: repository._id }, { $addToSet: { deployments: deployment._id } })
    ]);
    if(!repository.deployments) repository.deployments = [];
    repository.deployments.push(deployment._id);

    emitDeploymentStatus(userId, { repositoryId, deploymentId, status: 'building', jobId: job._id.toString() });

    const strategy = resolveStrategy(repository);
    if(strategy === 'exec'){
        const repositoryHandler = new RepositoryHandler(repository);
        await act.step('Building application', () => repositoryHandler.start(new Github(githubUser, repository)));
    }else{

        await act.step('Building application', () => runBuild(job));
        const built: any = await Deployment.findById(deployment._id).select('artifact');
        const imageOverride = built?.artifact?.tag || undefined;

        await ensureSubdomain(repository).catch(() => {});
        const extraLabels = await getIngressLabels(repository).catch(() => ({}));

        await containerService.removeContainer();
        await containerService.createAndStartContainer({ imageOverride, extraLabels });

        deployment.status = 'success';
        await deployment.save();
        await source.updateDeploymentStatus(deployment.githubDeploymentId, 'success').catch(() => {});
    }

    const finalDeployment = await Deployment.findById(deployment._id).select('status');
    const finalStatus = finalDeployment?.status || 'success';
    emitDeploymentStatus(userId, { repositoryId, deploymentId, status: finalStatus, jobId: job._id.toString() });

    if(finalStatus === 'success' && githubUser?.email){
        sendEmail({
            to: githubUser.email,
            subject: `Deployment for "${repository.alias}" completed successfully.`,
            html: `Hello @${githubUser.username},<br><br>The "${repository.alias}" repository has been deployed. It should be available in a few moments.<br><br>Regards.`
        }).catch(() => {});
    }

    if(finalStatus === 'failure'){

        throw new Error(`Deploy::Build::Failed::${repository.alias}`);
    }

    act.success(`Deployment for "${repository.alias}" completed`);
    }catch(error){

        emitDeploymentStatus(userId, {
            repositoryId,
            deploymentId: job.target?.deployment?.toString() || job.payload?.rollbackTo?.toString(),
            status: 'failure',
            jobId: job._id.toString()
        });
        act.fail('Deployment failed', error);
        throw error;
    }
};

export default runDeploy;
