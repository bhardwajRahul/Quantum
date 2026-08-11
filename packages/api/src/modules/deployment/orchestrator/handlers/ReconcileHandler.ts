import { In } from 'typeorm';
import DockerContainer from '@/modules/docker/models/DockerContainer';
import Deployment from '../../models/Deployment';
import Repository from '@/modules/repository/models/Repository';
import Job from '../../models/Job';
import ContainerOps from '../ContainerOps';
import IngressService from '../IngressService';
import { getDockerHost } from '../DockerHost';
import { ContainerDesiredState, ContainerStatus } from '@quantum/contracts/modules/docker/domain';
import { DeploymentStatus, JobStatus, JobType } from '@quantum/contracts/modules/deployment/domain';
import { logger } from '@/shared/utils/Logger';

const DEPLOY_LOCKING_JOB_TYPES: JobType[] = [
    JobType.Deploy, JobType.Redeploy, JobType.Build, JobType.Reload,
    JobType.Start, JobType.Stop, JobType.Restart
];

export default class ReconcileHandler{
    #ingress = new IngressService();

    async run(): Promise<void>{
        const desired = await DockerContainer.find();
        const actualNames = await this.#actualNames();

        let recreated = 0;
        let started = 0;
        let skipped = 0;
        for(const container of desired){
            const outcome = await this.#reconcileOne(container, actualNames);
            if(outcome === 'recreated') recreated++;
            else if(outcome === 'started') started++;
            else skipped++;
        }
        logger.info(`reconciled — recreated ${recreated}, started ${started}, skipped ${skipped}, total ${desired.length}`, { scope: 'orchestrator.handler.reconcile' });
    }

    async #actualNames(): Promise<Set<string>>{
        try{
            const actual = await getDockerHost().listContainers({ all: true });
            return new Set(actual.flatMap((entry) => (entry.Names || []).map((name) => name.replace(/^\//, ''))));
        }catch(error){
            logger.error('reconcile: cannot list containers', error, { scope: 'orchestrator.handler.reconcile' });
            throw error;
        }
    }

    async #reconcileOne(container: DockerContainer, actualNames: Set<string>): Promise<'recreated' | 'started' | 'skipped'>{
        if(container.desiredState === ContainerDesiredState.Stopped) return 'skipped';
        if(container.repositoryId && await this.#hasInFlightDeploy(container.repositoryId)) return 'skipped';

        const present = container.dockerContainerName ? actualNames.has(container.dockerContainerName) : false;
        const ops = new ContainerOps(container);
        try{
            if(!present){
                await this.#recreate(ops, container);
                return 'recreated';
            }
            if(container.status !== ContainerStatus.Running) await ops.start();
            return 'started';
        }catch(error){
            logger.error(`reconcile failed for ${container.dockerContainerName}`, error, { scope: 'orchestrator.handler.reconcile' });
            return 'skipped';
        }
    }

    async #recreate(ops: ContainerOps, container: DockerContainer): Promise<void>{
        let imageOverride: string | undefined;
        let extraLabels: Record<string, string> | undefined;
        if(container.repositoryId){
            imageOverride = await this.#lastSuccessTag(container.repositoryId);
            if(imageOverride) extraLabels = await this.#labels(container.repositoryId);
        }
        await ops.createAndStartContainer({ imageOverride, extraLabels });
        await ops.relaunchRepositoryApp();
    }

    async #hasInFlightDeploy(repositoryId: number): Promise<boolean>{
        const count = await Job.countBy({
            repositoryId,
            type: In(DEPLOY_LOCKING_JOB_TYPES),
            status: In([JobStatus.Active, JobStatus.Queued, JobStatus.Delayed])
        });
        return count > 0;
    }

    async #lastSuccessTag(repositoryId: number): Promise<string | undefined>{
        const last = await Deployment.findOne({
            where: { repositoryId, status: DeploymentStatus.Success },
            order: { createdAt: 'DESC', id: 'DESC' }
        });
        return last?.artifact?.tag || undefined;
    }

    async #labels(repositoryId: number): Promise<Record<string, string> | undefined>{
        const repository = await Repository.findOneBy({ id: repositoryId });
        if(!repository) return undefined;
        const labels = await this.#ingress.getIngressLabels(repository).catch(() => ({}));
        return Object.keys(labels).length > 0 ? labels : undefined;
    }
}
