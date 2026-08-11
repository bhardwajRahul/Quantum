import type { HealthCheckStatus, HealthCheckType } from '@quantum/contracts/modules/health-check/domain';

export interface HealthCheckFields{
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
    lastCheckedAt: Date | null;
    lastError: string | null;
    createdAt: Date;
    updatedAt: Date;
}
