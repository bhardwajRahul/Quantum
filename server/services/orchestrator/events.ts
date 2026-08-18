import { io } from '@config/express';
import logger from '@utilities/logger';

export const userRoom = (userId: string): string => `user:${userId}`;

const emit = (channel: string, userId: string | undefined, payload: object): void => {
    if(!userId) return;
    try{
        io.to(userRoom(userId)).emit(channel, payload);
    }catch(error){
        logger.error(`@services/orchestrator/events.ts (emit ${channel}): ` + error);
    }
};

interface DeploymentStatusEvent{
    repositoryId?: string;
    containerId?: string;
    deploymentId?: string;
    status: string;
    jobId?: string;
}

interface JobStatusEvent{
    jobId: string;
    type: string;
    status: string;
    error?: string;
}

interface MetricsSampleEvent{
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

interface HealthStatusEvent{
    healthCheckId: string;
    repositoryId?: string;
    status: string;
    error?: string;
}

const channelEmitter = <P extends object>(channel: string) =>
    (userId: string | undefined, payload: P): void => emit(channel, userId, payload);

export const emitDeploymentStatus = channelEmitter<DeploymentStatusEvent>('deployment:status');
export const emitJobStatus        = channelEmitter<JobStatusEvent>('job:status');
export const emitMetricsSample    = channelEmitter<MetricsSampleEvent>('metrics:sample');
export const emitHealthStatus     = channelEmitter<HealthStatusEvent>('health:status');
