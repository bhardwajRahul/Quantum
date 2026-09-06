import { promises as fs } from 'node:fs';
import Deployment from '../../models/Deployment';
import Repository from '@/modules/repository/models/Repository';
import DockerContainer from '@/modules/docker/models/DockerContainer';
import ActivityStepContext from '@/modules/activity/services/ActivityStepContext';
import { resolveStrategy, getBuilder } from '../build';
import { emitBuildLog, type BuildContext } from '../build/BuildContext';
import { emitStatusChanged } from '../statusEvents';
import { DeploymentStatus } from '@quantum/contracts/modules/deployment/domain';
import { logger } from '@/shared/utils/Logger';
import type Job from '../../models/Job';

const listSourceFiles = async (storagePath: string | null): Promise<string[]> => {
    if(!storagePath) return [];
    const files = await fs.readdir(storagePath).catch(() => null);
    return files ?? [];
};

export default class BuildHandler{
    async run(job: Job): Promise<void>{
        if(!job.repositoryId) throw new Error('Build::Repository::Required');
        if(!job.deploymentId) throw new Error('Build::Deployment::Required');

        const repository = await Repository.findOneBy({ id: job.repositoryId });
        if(!repository) throw new Error('Build::Repository::NotFound');
        const deployment = await Deployment.findOneBy({ id: job.deploymentId });
        if(!deployment) throw new Error('Build::Deployment::NotFound');

        const container = await DockerContainer.findOneBy({ repositoryId: repository.id });
        const storagePath = container?.storagePath ?? null;
        const nodeId = job.nodeId || 'local';

        const activity = new ActivityStepContext({
            organizationId: repository.organizationId,
            userId: job.userId ?? repository.userId,
            scope: 'deployment',
            source: 'orchestrator.build',
            correlationId: String(job.id)
        });

        deployment.status = DeploymentStatus.Building;
        await deployment.save();
        emitStatusChanged(deployment.id, repository.id, DeploymentStatus.Building);

        try{
            const strategy = await activity.step('Resolving build strategy', async () => {
                const files = await listSourceFiles(storagePath);
                const strategy = resolveStrategy(repository, files);
                emitBuildLog(deployment, `[build] Strategy resolved to "${strategy}"\n`);
                logger.info(`build repo=${repository.id} deployment=${deployment.id} strategy=${strategy}`, { scope: 'orchestrator.handler.build' });
                return strategy;
            });

            const ctx: BuildContext = { repository, deployment, container, nodeId, storagePath };
            const artifact = await activity.step('Building image artifact', () => getBuilder(strategy).build(ctx));

            await activity.step('Recording artifact', async () => {
                deployment.artifact = artifact;
                await deployment.save();
                emitBuildLog(deployment, `[build] Artifact recorded (builder=${artifact.builder}, tag=${artifact.tag || 'n/a'})\n`);
            });
        }catch(error){
            const message = error instanceof Error ? error.message : String(error);
            emitBuildLog(deployment, `[build] FAILED: ${message}\n`);
            deployment.status = DeploymentStatus.Failure;
            await deployment.save();
            emitStatusChanged(deployment.id, repository.id, DeploymentStatus.Failure);
            throw error;
        }
    }
}
