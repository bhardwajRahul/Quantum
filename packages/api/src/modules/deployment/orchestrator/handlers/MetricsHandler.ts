import { Not } from 'typeorm';
import DockerContainer from '@/modules/docker/models/DockerContainer';
import Metric from '@/modules/metric/models/Metric';
import { getDockerHost } from '../DockerHost';
import { sampleContainerStats, type ContainerRawStats } from '../metrics/stats';
import { ContainerDesiredState } from '@quantum/contracts/modules/docker/domain';
import { logger } from '@/shared/utils/Logger';

export default class MetricsHandler{
    async run(jobNodeId: string): Promise<void>{
        const nodeId = jobNodeId || 'local';
        const containers = await DockerContainer.find({ where: { desiredState: Not(ContainerDesiredState.Stopped) } });

        for(const container of containers){
            if(!container.dockerContainerName) continue;
            try{
                await this.#sampleOne(container, nodeId);
            }catch(error){
                const status = (error as { statusCode?: number }).statusCode;
                if(status !== 404){
                    logger.warn(`metrics sample ${container.dockerContainerName}: ${(error as Error).message}`, { scope: 'orchestrator.handler.metrics' });
                }
            }
        }
    }

    async #sampleOne(container: DockerContainer, nodeId: string): Promise<void>{
        const raw = await getDockerHost(nodeId).client().getContainer(container.dockerContainerName).stats({ stream: false }) as ContainerRawStats;

        await Metric.create({
            containerId: container.id,
            organizationId: container.organizationId,
            repositoryId: container.repositoryId,
            projectId: container.projectId,
            userId: container.userId,
            nodeId,
            ...sampleContainerStats(raw),
            ts: new Date()
        }).save();
    }
}
