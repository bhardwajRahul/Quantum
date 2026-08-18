import HealthCheck from '@models/healthCheck';
import DockerContainer from '@models/docker/container';
import DockerContainerService from '@services/docker/container';
import { runProbe, evaluateHealthTransition } from '@services/health/probe';
import { enqueueLifecycle } from '@services/orchestrator';
import { emitHealthStatus } from '@services/orchestrator/events';
import logger from '@utilities/logger';
import { IJob } from '@typings/models/job';

export const runHealthCheck = async (job: IJob): Promise<void> => {
    const checks = await HealthCheck.find({ enabled: true });

    for(const check of checks){
        try{
            const container = await DockerContainer.findOne({ repository: check.repository })
                .select('dockerContainerName user repository');
            if(!container){
                continue;
            }
            const containerService = new DockerContainerService(container);
            const probe = await runProbe(containerService, check);

            const result = evaluateHealthTransition(
                {
                    status: check.status,
                    consecutiveFailures: check.consecutiveFailures,
                    consecutiveSuccesses: check.consecutiveSuccesses
                },
                probe.ok,
                check.healthyThreshold,
                check.unhealthyThreshold
            );

            check.status = result.status;
            check.consecutiveFailures = result.consecutiveFailures;
            check.consecutiveSuccesses = result.consecutiveSuccesses;
            check.lastCheckedAt = new Date();
            check.lastError = probe.ok ? undefined : probe.error;
            await check.save();

            if(!result.transitioned) continue;

            const repositoryId = check.repository?.toString();
            const userId = check.user?.toString() || (container.user ? container.user.toString() : undefined);
            emitHealthStatus(userId, {
                healthCheckId: check._id.toString(),
                repositoryId,
                status: result.status,
                error: probe.error
            });

            if(result.status === 'unhealthy'){
                if(check.autoRestart && repositoryId){
                    await enqueueLifecycle(repositoryId, 'restart', userId).catch((error) =>
                        logger.error('@services/orchestrator/handlers/healthHandler.ts (autoRestart): ' + error));
                }
            }
        }catch(error: any){
            logger.warn(`@services/orchestrator/handlers/healthHandler.ts (runHealthCheck): ${check._id}: ${error?.message || error}`);
        }
    }
};

export default runHealthCheck;
