import DockerContainer from '@models/docker/container';
import Metric from '@models/metric';
import mongoose from 'mongoose';
import { getDockerHost } from '@services/docker/host';
import { sampleContainerStats } from '@services/metrics/stats';
import { emitMetricsSample } from '@services/orchestrator/events';
import logger from '@utilities/logger';
import { IJob } from '@typings/models/job';

export const runMetricsSample = async (job: IJob): Promise<void> => {
    const nodeId = job.nodeId || 'local';
    const host = getDockerHost(nodeId);

    const containers = await DockerContainer.find({ desiredState: { $ne: 'stopped' } })
        .select('dockerContainerName repository user organization');

    const projectByRepo = new Map<string, mongoose.Types.ObjectId | undefined>();

    for(const container of containers){
        const name = container.dockerContainerName;
        if(!name) continue;
        try{
            const raw: any = await host.client().getContainer(name).stats({ stream: false });
            const normalized = sampleContainerStats(raw);
            const userId = container.user ? container.user.toString() : undefined;

            let project: mongoose.Types.ObjectId | undefined;
            if(container.repository){
                const repoKey = container.repository.toString();
                if(projectByRepo.has(repoKey)){
                    project = projectByRepo.get(repoKey);
                }else{
                    const repo = await mongoose.model('Repository').findById(container.repository).select('project organization');
                    project = repo?.project;
                    projectByRepo.set(repoKey, project);
                }
            }

            await Metric.create({
                container: container._id,
                organization: (container as any).organization,
                repository: container.repository,
                project,
                user: container.user,
                nodeId,
                ...normalized,
                ts: new Date()
            });

            emitMetricsSample(userId, {
                containerId: container._id.toString(),
                repositoryId: container.repository ? container.repository.toString() : undefined,
                cpuPercent: normalized.cpuPercent,
                memPercent: normalized.memPercent,
                memUsage: normalized.memUsage,
                memLimit: normalized.memLimit,
                netRx: normalized.netRx,
                netTx: normalized.netTx,
                pids: normalized.pids,
                ts: Date.now()
            });
        }catch(error: any){

            if(error?.statusCode !== 404){
                logger.warn(`@services/orchestrator/handlers/metricsHandler.ts (runMetricsSample): ${name}: ${error?.message || error}`);
            }
        }
    }
};

export default runMetricsSample;
