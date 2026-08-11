import HealthCheck from '@/modules/health-check/models/HealthCheck';
import DockerContainer from '@/modules/docker/models/DockerContainer';
import ContainerOps from '../ContainerOps';
import OrchestratorService from '../OrchestratorService';
import { runProbe } from '../health/probe';
import { evaluateHealthTransition } from '../health/hysteresis';
import { HealthCheckStatus } from '@quantum/contracts/modules/health-check/domain';
import { logger } from '@/shared/utils/Logger';

export default class HealthHandler{
    #orchestrator = new OrchestratorService();

    async run(): Promise<void>{
        const checks = await HealthCheck.find({ where: { enabled: true } });
        for(const check of checks){
            try{
                await this.#checkOne(check);
            }catch(error){
                logger.warn(`health check ${check.id} failed: ${(error as Error).message}`, { scope: 'orchestrator.handler.health' });
            }
        }
    }

    async #checkOne(check: HealthCheck): Promise<void>{
        const container = await DockerContainer.findOneBy({ repositoryId: check.repositoryId });
        if(!container) return;

        const probe = await runProbe(new ContainerOps(container), check);
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
        check.lastError = probe.ok ? null : (probe.error ?? null);
        await check.save();

        if(!result.transitioned) return;
        await this.#maybeAutoRestart(check, result.status);
    }

    async #maybeAutoRestart(check: HealthCheck, status: HealthCheckStatus): Promise<void>{
        if(status !== HealthCheckStatus.Unhealthy || !check.autoRestart || !check.repositoryId) return;
        await this.#orchestrator.lifecycle(check.repositoryId, 'restart', check.userId ?? undefined).catch((error) =>
            logger.error('health autoRestart enqueue failed', error, { scope: 'orchestrator.handler.health' }));
    }
}
