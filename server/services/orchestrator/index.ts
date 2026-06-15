/***
 * Copyright (C) Rodolfo Herrera Hernandez. All rights reserved.
 * Licensed under the MIT license. See LICENSE file in the project root
 * for full license information.
 *
 * =+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+
 *
 * For related information - https://github.com/rodyherrera/Quantum/
 *
 * All your applications, just in one place.
 *
 * =-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-
****/

import queue, { EnqueueInput } from '@services/queue';
import { Worker } from '@services/orchestrator/worker';
import { ensureEdgeNetwork } from '@services/docker/network';
import { IJob, JobType } from '@typings/models/job';
import logger from '@utilities/logger';

/**
 * THE single funnel for all asynchronous platform work. Every build/lifecycle
 * trigger — repo create, command update, webhook push, manual start/stop/restart,
 * boot reconcile — goes through enqueueJob (or one of the sugar helpers below).
 * Nothing else talks to the queue directly, so swapping the queue backend or
 * adding cross-cutting policy (quotas, audit) happens in one place.
 */
export const enqueueJob = (input: EnqueueInput): Promise<IJob> => queue.add(input);

export const enqueueDeploy = (
    repositoryId: string,
    options: { reason?: 'initial' | 'push' | 'manual' | 'reconcile' | 'rollback'; commit?: string; userId?: string; rollbackTo?: string } = {}
): Promise<IJob> => {
    const reason = options.reason || 'manual';
    // Dedupe duplicate webhook deliveries for the same commit; serialize per repo.
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

/**
 * Enqueue a durable reload (recreate-in-place) of a single container after an
 * environment/command/port-binding change. Serialized per-container via lockKey
 * so concurrent edits don't race the recreate. Replaces the fire-and-forget
 * reloadContainer() that used to run inside the model hooks (ADR-0001).
 */
export const enqueueReload = (
    containerId: string,
    options: { userId?: string } = {}
): Promise<IJob> => enqueueJob({
    type: 'reload',
    target: { container: containerId, user: options.userId },
    lockKey: `container:${containerId}`
});

/**
 * Enqueue a managed-database job (provision/backup/restore). The Database id rides
 * in payload (the Job target has no database slot); serialized per-database via
 * lockKey so a backup never races a provision/restore for the same database.
 */
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

/**
 * Enqueue the full cascade delete of an organization: every resource carrying its
 * `organization` ref is torn down (DB rows + real infra via per-model delete
 * hooks), then the org itself. Serialized per-org via lockKey; idempotent (the
 * handler no-ops if the org is already gone), so a retry after a partial failure
 * safely resumes.
 */
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

/**
 * Observability sampling enqueues. Both are serialized per node (lockKey) and
 * maxAttempts:1 — a missed sample is fine; we never want a backlog of retries
 * piling up behind a slow daemon. The handlers do the per-container/per-check work.
 */
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

/**
 * Web-analytics sampling: parse new Traefik access-log lines into per-domain
 * AnalyticsEvent rows + hourly rollups. Serialized per node, maxAttempts:1 — a
 * missed pass just gets picked up next tick (the tail offset persists).
 */
export const enqueueAnalyticsSample = (nodeId: string = 'local'): Promise<IJob> => enqueueJob({
    type: 'analytics:sample',
    target: {},
    nodeId,
    lockKey: `analytics:${nodeId}`,
    maxAttempts: 1
});

/**
 * Codespace lifecycle (provision/delete). The Codespace id rides in payload
 * (mirrors enqueueDatabaseJob); serialized per-codespace via lockKey so a delete
 * never races a provision for the same instance.
 */
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

/**
 * Boot the orchestrator: start the worker pool, kick an initial reconcile (boot
 * self-heal — replaces bootstrap.deployContainers), and schedule periodic
 * reconciles. Idempotent.
 */
export const startOrchestrator = async (): Promise<void> => {
    if(worker) return;
    if(process.env.ORCHESTRATOR_ENABLED === 'false'){
        logger.warn('@services/orchestrator: ORCHESTRATOR_ENABLED=false — worker not started.');
        return;
    }
    const nodeId = process.env.NODE_ID || 'local';
    worker = new Worker(queue, { nodeId });
    worker.start();

    // Ensure the shared ingress/edge network exists before any container needs to
    // attach to it (Traefik + managed databases live here). Idempotent.
    await ensureEdgeNetwork().catch((error) =>
        logger.error('@services/orchestrator: ensureEdgeNetwork failed: ' + error));

    // Boot reconcile: recreate missing containers, start the ones that should run,
    // and leave deliberately-stopped ones alone.
    await enqueueReconcile(nodeId).catch((error) =>
        logger.error('@services/orchestrator: initial reconcile enqueue failed: ' + error));

    const intervalMs = Number(process.env.RECONCILE_INTERVAL_MS) || 300000;
    reconcileTimer = setInterval(() => {
        enqueueReconcile(nodeId).catch((error) =>
            logger.error('@services/orchestrator: periodic reconcile enqueue failed: ' + error));
    }, intervalMs);

    // Observability sampling loops (kill-switchable). Metrics sample the running
    // fleet's resource usage; health re-evaluates probes with threshold hysteresis.
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
    // Web-analytics sampling loop (kill-switchable): tails Traefik access logs.
    if(process.env.ANALYTICS_ENABLED !== 'false'){
        const analyticsMs = Number(process.env.ANALYTICS_INTERVAL_MS) || 30000;
        analyticsTimer = setInterval(() => {
            enqueueAnalyticsSample(nodeId).catch((error) =>
                logger.error('@services/orchestrator: analytics enqueue failed: ' + error));
        }, analyticsMs);
    }

    logger.info(`@services/orchestrator: started (node=${nodeId}, reconcile every ${intervalMs}ms).`);
};
