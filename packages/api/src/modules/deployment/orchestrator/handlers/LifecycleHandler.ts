import Repository from '@/modules/repository/models/Repository';
import DockerContainer from '@/modules/docker/models/DockerContainer';
import Deployment from '../../models/Deployment';
import ContainerOps from '../ContainerOps';
import { emitStatusChanged, emitCompleted } from '../statusEvents';
import { failureMessage } from '../failureMessage';
import { ContainerDesiredState } from '@quantum/contracts/modules/docker/domain';
import { DeploymentStatus } from '@quantum/contracts/modules/deployment/domain';
import { DeploymentError } from '../../contracts/domain/errors';
import type Job from '../../models/Job';

export default class LifecycleHandler{
    async run(job: Job): Promise<void>{
        const action = job.payload.action as 'start' | 'stop' | 'restart';
        if(!job.repositoryId) throw DeploymentError.OperationFailed('Lifecycle::Repository::Required');

        const repository = await Repository.findOneBy({ id: job.repositoryId });
        if(!repository) throw DeploymentError.NotFound('Lifecycle::Repository::NotFound');

        const container = await DockerContainer.findOneBy({ repositoryId: repository.id });
        if(!container) throw DeploymentError.NotFound('Lifecycle::Container::NotFound');

        const deployment = await this.#latestDeployment(repository.id);
        if(deployment) await this.#setStatus(deployment, DeploymentStatus.Queued);
        emitStatusChangedFor(repository.id, deployment, DeploymentStatus.Queued);

        try{
            await this.#apply(container, action);
            const finalStatus = action === 'stop' ? DeploymentStatus.Stopped : DeploymentStatus.Success;
            if(deployment) await this.#setStatus(deployment, finalStatus);
            emitStatusChangedFor(repository.id, deployment, finalStatus);
            if(deployment) emitCompleted(deployment.id, repository.id, finalStatus);
        }catch(error){
            if(deployment) await this.#setStatus(deployment, DeploymentStatus.Failure, failureMessage(error));
            emitStatusChangedFor(repository.id, deployment, DeploymentStatus.Failure);
            throw error;
        }
    }

    async #apply(container: DockerContainer, action: 'start' | 'stop' | 'restart'): Promise<void>{
        const ops = new ContainerOps(container);
        switch(action){
            case 'restart':
                await ops.restart();
                return;
            case 'stop':
                await ops.stop();
                container.desiredState = ContainerDesiredState.Stopped;
                await container.save();
                return;
            case 'start':
                container.desiredState = ContainerDesiredState.Running;
                await container.save();
                await ops.start();
                return;
            default:
                throw DeploymentError.OperationFailed('Lifecycle::Invalid::Action');
        }
    }

    async #latestDeployment(repositoryId: number): Promise<Deployment | null>{
        return Deployment.findOne({ where: { repositoryId }, order: { createdAt: 'DESC', id: 'DESC' } });
    }

    async #setStatus(deployment: Deployment, status: DeploymentStatus, error: string | null = null): Promise<void>{
        deployment.status = status;
        // A successful start clears whatever the previous attempt left behind.
        deployment.error = error;
        await deployment.save();
    }
}

const emitStatusChangedFor = (repositoryId: number, deployment: Deployment | null, status: DeploymentStatus): void => {
    if(!deployment) return;
    emitStatusChanged(deployment.id, repositoryId, status);
};
