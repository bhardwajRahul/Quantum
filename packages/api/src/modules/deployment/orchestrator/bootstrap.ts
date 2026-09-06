import JobRunner from './JobRunner';
import { buildHandlerMap } from './HandlerRegistry';
import { writeUpstreamConfig } from '@/modules/domain/services/UpstreamRouterFile';
import { ensureEdgeNetwork } from './NetworkOps';
import OrchestratorService from './OrchestratorService';
import { config } from '@/shared/config';
import { logger } from '@/shared/utils/Logger';

let runner: JobRunner | null = null;
const timers: NodeJS.Timeout[] = [];

const enabled = (): boolean =>
    process.env.ORCHESTRATOR_ENABLED !== 'false' && config.nodeEnv !== 'test';

const interval = (key: string, fallback: number): number =>
    Number(process.env[key]) || fallback;

const schedule = (ms: number, enqueue: () => Promise<unknown>, label: string): void => {
    timers.push(setInterval(() => {
        enqueue().catch((error) => logger.error(`${label} enqueue failed`, error, { scope: 'orchestrator' }));
    }, ms));
};

export const startOrchestrator = (): void => {
    if(runner || !enabled()) return;

    const orchestrator = new OrchestratorService();
    runner = new JobRunner(buildHandlerMap());
    runner.start();

    ensureEdgeNetwork().catch((error) => logger.error('ensureEdgeNetwork failed', error, { scope: 'orchestrator' }));

    writeUpstreamConfig().catch((error) =>
        logger.error('publishing the upstream routes on boot failed', error, { scope: 'orchestrator' }));
    orchestrator.reconcile().catch((error) => logger.error('initial reconcile enqueue failed', error, { scope: 'orchestrator' }));

    schedule(interval('RECONCILE_INTERVAL_MS', 300000), () => orchestrator.reconcile(), 'reconcile');
    if(process.env.METRICS_ENABLED !== 'false'){
        schedule(interval('METRICS_INTERVAL_MS', 20000), () => orchestrator.metricsSample(), 'metrics');
    }
    if(process.env.HEALTH_ENABLED !== 'false'){
        schedule(interval('HEALTH_INTERVAL_MS', 30000), () => orchestrator.healthCheck(), 'health');
    }
    if(process.env.ANALYTICS_ENABLED !== 'false'){
        schedule(interval('ANALYTICS_INTERVAL_MS', 30000), () => orchestrator.analyticsSample(), 'analytics');
    }

    logger.info('orchestrator started', { scope: 'orchestrator' });
};

export const stopOrchestrator = (): void => {
    runner?.stop();
    runner = null;
    for(const timer of timers) clearInterval(timer);
    timers.length = 0;
};
