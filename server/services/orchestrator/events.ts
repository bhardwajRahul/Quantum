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

import { io } from '@config/express';
import logger from '@utilities/logger';

/**
 * Per-user socket room. wsController joins each authenticated socket to this room
 * so deploy/job status can be pushed live (replacing the SPA's 60s polling for
 * status). Kept as a helper so the room naming is defined in exactly one place.
 */
export const userRoom = (userId: string): string => `user:${userId}`;

/**
 * Emit a socket event to the owning user's room. No-op if the user is unknown;
 * never throws (a socket delivery failure must not break the orchestrator). All
 * the typed emit* helpers below are thin wrappers that fix the channel name.
 */
const emit = (channel: string, userId: string | undefined, payload: object): void => {
    if(!userId) return;
    try{
        io.to(userRoom(userId)).emit(channel, payload);
    }catch(error){
        logger.error(`@services/orchestrator/events.ts (emit ${channel}): ` + error);
    }
};

export interface DeploymentStatusEvent{
    repositoryId?: string;
    containerId?: string;
    deploymentId?: string;
    status: string;
    jobId?: string;
}

/**
 * Push a deployment/lifecycle status change to the owning user's room. Because
 * deploys are now asynchronous (the API returns 202 before the build finishes),
 * this is how the client learns the outcome in real time.
 */
export const emitDeploymentStatus = (userId: string | undefined, payload: DeploymentStatusEvent): void =>
    emit('deployment:status', userId, payload);

export interface JobStatusEvent{
    jobId: string;
    type: string;
    status: string;
    error?: string;
}

export const emitJobStatus = (userId: string | undefined, payload: JobStatusEvent): void =>
    emit('job:status', userId, payload);

export interface MetricsSampleEvent{
    containerId?: string;
    repositoryId?: string;
    cpuPercent: number;
    memPercent: number;
    memUsage: number;
    memLimit: number;
    netRx: number;
    netTx: number;
    pids: number;
    ts: number;
}

/**
 * Push a fresh resource sample to the owning user's room so dashboards can update
 * live instead of re-polling the metrics window. Mirrors emitDeploymentStatus.
 */
export const emitMetricsSample = (userId: string | undefined, payload: MetricsSampleEvent): void =>
    emit('metrics:sample', userId, payload);

export interface HealthStatusEvent{
    healthCheckId: string;
    repositoryId?: string;
    status: string;
    error?: string;
}

/** Push a health-status transition (only on change) to the owning user's room. */
export const emitHealthStatus = (userId: string | undefined, payload: HealthStatusEvent): void =>
    emit('health:status', userId, payload);

export interface AlertEvent{
    event: string;
    ruleId?: string;
    repositoryId?: string;
    message?: string;
}

/** Push an alert to the owning user's room (in addition to email/webhook delivery). */
export const emitAlert = (userId: string | undefined, payload: AlertEvent): void =>
    emit('alert', userId, payload);
