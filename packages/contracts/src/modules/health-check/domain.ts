import type { BaseEntity } from '../../shared/base';

export enum HealthCheckType{
    Http = 'http',
    Tcp = 'tcp',
    Cmd = 'cmd'
}

export enum HealthCheckStatus{
    Healthy = 'healthy',
    Unhealthy = 'unhealthy',
    Unknown = 'unknown'
}

export interface HealthCheck extends BaseEntity{
    organizationId: number;
    repositoryId: number;
    projectId: number | null;
    userId: number | null;
    nodeId: string;
    type: HealthCheckType;
    path: string;
    port: number | null;
    command: string | null;
    intervalSec: number;
    timeoutSec: number;
    healthyThreshold: number;
    unhealthyThreshold: number;
    enabled: boolean;
    autoRestart: boolean;
    gateDeploy: boolean;
    status: HealthCheckStatus;
    consecutiveFailures: number;
    consecutiveSuccesses: number;
    lastCheckedAt: string | null;
    lastError: string | null;
}
