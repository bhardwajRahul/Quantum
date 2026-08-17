import Repository from '@/modules/repository/models/Repository';
import Deployment from '../../models/Deployment';
import DockerContainer from '@/modules/docker/models/DockerContainer';
import ProvisionService from '../ProvisionService';
import ContainerOps from '../ContainerOps';
import IngressService from '../IngressService';
import ActivityStepContext from '@/modules/activity/services/ActivityStepContext';
import { resolveStrategy, getBuilder } from '../build';
import { emitBuildLog, type BuildContext } from '../build/BuildContext';
import { emitStatusChanged, emitCompleted } from '../statusEvents';
import { BuildStrategy } from '@quantum/contracts/modules/repository/domain';
import { DeploymentStatus } from '@quantum/contracts/modules/deployment/domain';
import { logger } from '@/shared/utils/Logger';
import type Job from '../../models/Job';

export default class DeployHandler{
    #provision = new ProvisionService();
    #ingress = new IngressService();

    async run(job: Job): Promise<void>{
        if(!job.repositoryId) throw new Error('Deploy::Repository::Required');
        const repository = await Repository.findOneBy({ id: job.repositoryId });
        if(!repository) throw new Error('Deploy::Repository::NotFound');

        const activity = new ActivityStepContext({
            organizationId: repository.organizationId,
            userId: job.userId ?? repository.userId,
            scope: 'deployment',
            source: 'orchestrator.deploy',
            correlationId: String(job.id)
        });

        const reason = (job.payload.reason as string) ?? 'manual';
        if(reason === 'rollback') return this.#rollback(job, repository, activity);
        await this.#forward(job, repository, activity);
    }

    async #rollback(job: Job, repository: Repository, activity: ActivityStepContext): Promise<void>{
        await activity.progress('Rolling back to previous artifact');

        const rollbackTo = job.payload.rollbackTo as number | null;
        const target = rollbackTo
            ? await Deployment.findOneBy({ id: rollbackTo, repositoryId: repository.id })
            : null;
        const tag = target?.artifact?.tag;
        if(!tag) throw new Error('Deploy::Rollback::NoArtifact');

        const container = await this.#provision.ensureRepositoryInfra(repository);
        const ops = new ContainerOps(container);
        await ops.removeContainer();
        await ops.createAndStartContainer({ imageOverride: tag, extraLabels: await this.#labels(repository) });

        await Deployment.update(
            { repositoryId: repository.id, status: DeploymentStatus.Success },
            { status: DeploymentStatus.Rolledback }
        );
        if(target){
            emitStatusChanged(target.id, repository.id, DeploymentStatus.Rolledback);
            emitCompleted(target.id, repository.id, DeploymentStatus.Rolledback);
        }
    }

    async #forward(job: Job, repository: Repository, activity: ActivityStepContext): Promise<void>{
        const container = await activity.step('Provisioning infrastructure', () => this.#provision.ensureRepositoryInfra(repository));
        await new ContainerOps(container).stop().catch((error) =>
            logger.warn(`stop before redeploy failed (continuing): ${(error as Error).message}`, { scope: 'orchestrator.handler.deploy' }));

        const deployment = await this.#createDeployment(job, repository);
        emitStatusChanged(deployment.id, repository.id, DeploymentStatus.Building);

        try{
            await activity.step('Building application', () => this.#buildAndLaunch(job, repository, container, deployment));
            deployment.status = DeploymentStatus.Success;
            await deployment.save();
            emitStatusChanged(deployment.id, repository.id, DeploymentStatus.Success);
            emitCompleted(deployment.id, repository.id, DeploymentStatus.Success);
        }catch(error){
            deployment.status = DeploymentStatus.Failure;
            await deployment.save();
            emitStatusChanged(deployment.id, repository.id, DeploymentStatus.Failure);
            emitCompleted(deployment.id, repository.id, DeploymentStatus.Failure);
            throw error;
        }
    }

    async #createDeployment(job: Job, repository: Repository): Promise<Deployment>{
        return Deployment.create({
            repositoryId: repository.id,
            userId: job.userId ?? repository.userId,
            organizationId: repository.organizationId,
            environmentId: repository.environmentId,
            githubDeploymentId: null,
            status: DeploymentStatus.Building,
            commit: null,
            artifact: null,
            url: null,
            environmentVariables: {}
        }).save();
    }

    async #buildAndLaunch(job: Job, repository: Repository, container: DockerContainer, deployment: Deployment): Promise<void>{
        const strategy = resolveStrategy(repository, []);
        if(strategy === BuildStrategy.Exec){
            emitBuildLog(deployment, '[build] Exec strategy: in-container build deferred to runtime\n');
            return;
        }
        const ctx: BuildContext = {
            repository,
            deployment,
            container,
            nodeId: job.nodeId,
            storagePath: container.storagePath
        };
        const artifact = await getBuilder(strategy).build(ctx);
        deployment.artifact = artifact;
        await deployment.save();

        await this.#ingress.ensureSubdomain(repository).catch(() => undefined);
        const ops = new ContainerOps(container);
        await ops.removeContainer();
        await ops.createAndStartContainer({ imageOverride: artifact.tag, extraLabels: await this.#labels(repository) });
    }

    async #labels(repository: Repository): Promise<Record<string, string>>{
        return this.#ingress.getIngressLabels(repository).catch(() => ({}));
    }
}
