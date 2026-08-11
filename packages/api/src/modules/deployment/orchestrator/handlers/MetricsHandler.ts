import { Not } from 'typeorm';
import DockerContainer from '@/modules/docker/models/DockerContainer';
import Repository from '@/modules/repository/models/Repository';
import Metric from '@/modules/metric/models/Metric';
import { getDockerHost } from '../DockerHost';
import { sampleContainerStats, type ContainerRawStats } from '../metrics/stats';
import { ContainerDesiredState } from '@quantum/contracts/modules/docker/domain';
import { logger } from '@/shared/utils/Logger';

export default class MetricsHandler{
    async run(jobNodeId: string): Promise<void>{
        const nodeId = jobNodeId || 'local';
        const containers = await DockerContainer.find({ where: { desiredState: Not(ContainerDesiredState.Stopped) } });
        const projectByRepo = new Map<number, number | null>();

        for(const container of containers){
            if(!container.dockerContainerName) continue;
            try{
                await this.#sampleOne(container, nodeId, projectByRepo);
            }catch(error){
                const status = (error as { statusCode?: number }).statusCode;
                if(status !== 404){
                    logger.warn(`metrics sample ${container.dockerContainerName}: ${(error as Error).message}`, { scope: 'orchestrator.handler.metrics' });
                }
            }
        }
    }

    async #sampleOne(container: DockerContainer, nodeId: string, projectByRepo: Map<number, number | null>): Promise<void>{
        const raw = await getDockerHost(nodeId).client().getContainer(container.dockerContainerName).stats({ stream: false }) as ContainerRawStats;
        const normalized = sampleContainerStats(raw);
        const projectId = await this.#projectId(container.repositoryId, projectByRepo);

        await Metric.create({
            containerId: container.id,
            organizationId: container.organizationId,
            repositoryId: container.repositoryId,
            projectId,
            userId: container.userId,
            nodeId,
            ...normalized,
            ts: new Date()
        }).save();
    }

    async #projectId(repositoryId: number | null, cache: Map<number, number | null>): Promise<number | null>{
        if(repositoryId === null) return null;
        if(cache.has(repositoryId)) return cache.get(repositoryId) ?? null;
        const repository = await Repository.findOneBy({ id: repositoryId });
        const projectId = repository?.projectId ?? null;
        cache.set(repositoryId, projectId);
        return projectId;
    }
}
