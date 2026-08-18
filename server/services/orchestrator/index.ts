import queue, { EnqueueInput } from '@services/queue';
import { Worker } from '@services/orchestrator/worker';
import { ensureEdgeNetwork } from '@services/docker/network';
import { IJob, JobType } from '@typings/models/job';
import logger from '@utilities/logger';

export const enqueueJob = (input: EnqueueInput): Promise<IJob> => queue.add(input);

export const enqueueDeploy = (
    repositoryId: string,
    options: { reason?: 'initial' | 'push' | 'manual' | 'reconcile' | 'rollback'; commit?: string; userId?: string; rollbackTo?: string } = {}
): Promise<IJob> => {
    const reason = options.reason || 'manual';

    const idempotencyKey = options.commit
        ? `deploy:${repositoryId}:${options.commit}`
        : undefined;
    return enqueueJob({
        type: 'deploy',
        target: { repository: repositoryId, user: options.userId },
        payload: { reason, commit: options.commit, rollbackTo: options.rollbackTo },
        lockKey: `repo:${repositoryId}`,
        idempotencyKey
    });
};

export const enqueueLifecycle = (
    repositoryId: string,
    action: 'start' | 'stop' | 'restart',
    userId?: string
): Promise<IJob> => enqueueJob({
    type: action as JobType,
    target: { repository: repositoryId, user: userId },
    payload: { action },
    lockKey: `repo:${repositoryId}`
});

export const enqueueReload = (
    containerId: string,
    options: { userId?: string } = {}
): Promise<IJob> => enqueueJob({
    type: 'reload',
    target: { container: containerId, user: options.userId },
    lockKey: `container:${containerId}`
});

export const enqueueDatabaseJob = (
    type: 'db:provision' | 'db:backup' | 'db:restore',
    databaseId: string,
    options: { userId?: string; projectId?: string; backupId?: string } = {}
): Promise<IJob> => enqueueJob({
    type,
    target: { user: options.userId, project: options.projectId },
    payload: { databaseId, ...(options.backupId ? { backupId: options.backupId } : {}) },
    lockKey: `database:${databaseId}`
});

export const enqueueReconcile = (nodeId: string = 'local'): Promise<IJob> => enqueueJob({
    type: 'reconcile',
    target: {},
    nodeId,
    lockKey: `reconcile:${nodeId}`,
    maxAttempts: 1
});

export const enqueueOrgCascadeDelete = (
    organizationId: string,
    options: { userId?: string } = {}
): Promise<IJob> => enqueueJob({
    type: 'org:cascade-delete',
    target: { organization: organizationId, user: options.userId },
    lockKey: `org:${organizationId}`,
    idempotencyKey: `org-cascade:${organizationId}`,
    maxAttempts: 3
});

export const enqueueProjectCascadeDelete = (
    projectId: string,
    options: { userId?: string } = {}
): Promise<IJob> => enqueueJob({
    type: 'project:cascade-delete',
    target: { project: projectId, user: options.userId },
    lockKey: `project:${projectId}`,
    idempotencyKey: `project-cascade:${projectId}`,
    maxAttempts: 3
});

export const enqueueMetricsSample = (nodeId: string = 'local'): Promise<IJob> => enqueueJob({
    type: 'metrics:sample',
    target: {},
    nodeId,
    lockKey: `metrics:${nodeId}`,
    maxAttempts: 1
});

export const enqueueHealthCheck = (nodeId: string = 'local'): Promise<IJob> => enqueueJob({
    type: 'health:check',
    target: {},
    nodeId,
    lockKey: `health:${nodeId}`,
    maxAttempts: 1
});

export const enqueueAnalyticsSample = (nodeId: string = 'local'): Promise<IJob> => enqueueJob({
    type: 'analytics:sample',
    target: {},
    nodeId,
    lockKey: `analytics:${nodeId}`,
    maxAttempts: 1
});

export const enqueueCodespaceJob = (
    type: 'codespace:provision' | 'codespace:delete',
    codespaceId: string,
    options: { userId?: string; projectId?: string } = {}
): Promise<IJob> => enqueueJob({
    type,
    target: { user: options.userId, project: options.projectId },
    payload: { codespaceId },
    lockKey: `codespace:${codespaceId}`
});

let worker: Worker | null = null;
let reconcileTimer: NodeJS.Timeout | null = null;
let metricsTimer: NodeJS.Timeout | null = null;
let healthTimer: NodeJS.Timeout | null = null;
let analyticsTimer: NodeJS.Timeout | null = null;

const NODE_ID_RE = /^[a-z0-9]+(?:[._-][a-z0-9]+)*$/;
const validateNodeId = (nodeId: string): void => {
    if(!NODE_ID_RE.test(nodeId)){
        throw new Error(`Orchestrator::NodeId::Invalid::${nodeId} (must match ${NODE_ID_RE})`);
    }
};

export const startOrchestrator = async (): Promise<void> => {
    if(worker) return;
    if(process.env.ORCHESTRATOR_ENABLED === 'false'){
        logger.warn('@services/orchestrator: ORCHESTRATOR_ENABLED=false — worker not started.');
        return;
    }
    const nodeId = process.env.NODE_ID || 'local';

    validateNodeId(nodeId);
    worker = new Worker(queue, { nodeId });
    worker.start();

    await ensureEdgeNetwork().catch((error) =>
        logger.error('@services/orchestrator: ensureEdgeNetwork failed: ' + error));

    await enqueueReconcile(nodeId).catch((error) =>
        logger.error('@services/orchestrator: initial reconcile enqueue failed: ' + error));

    const intervalMs = Number(process.env.RECONCILE_INTERVAL_MS) || 300000;
    reconcileTimer = setInterval(() => {
        enqueueReconcile(nodeId).catch((error) =>
            logger.error('@services/orchestrator: periodic reconcile enqueue failed: ' + error));
    }, intervalMs);

    if(process.env.METRICS_ENABLED !== 'false'){
        const metricsMs = Number(process.env.METRICS_INTERVAL_MS) || 20000;
        metricsTimer = setInterval(() => {
            enqueueMetricsSample(nodeId).catch((error) =>
                logger.error('@services/orchestrator: metrics enqueue failed: ' + error));
        }, metricsMs);
    }
    if(process.env.HEALTH_ENABLED !== 'false'){
        const healthMs = Number(process.env.HEALTH_INTERVAL_MS) || 30000;
        healthTimer = setInterval(() => {
            enqueueHealthCheck(nodeId).catch((error) =>
                logger.error('@services/orchestrator: health enqueue failed: ' + error));
        }, healthMs);
    }

    if(process.env.ANALYTICS_ENABLED !== 'false'){
        const analyticsMs = Number(process.env.ANALYTICS_INTERVAL_MS) || 30000;
        analyticsTimer = setInterval(() => {
            enqueueAnalyticsSample(nodeId).catch((error) =>
                logger.error('@services/orchestrator: analytics enqueue failed: ' + error));
        }, analyticsMs);
    }

    logger.info(`@services/orchestrator: started (node=${nodeId}, reconcile every ${intervalMs}ms).`);
};
