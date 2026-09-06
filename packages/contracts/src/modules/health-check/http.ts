import type { HealthCheckType } from './domain';

interface HealthCheckFields{
    type?: HealthCheckType;
    path?: string;
    intervalSec?: number;
    timeoutSec?: number;
    healthyThreshold?: number;
    unhealthyThreshold?: number;
    enabled?: boolean;
    autoRestart?: boolean;
    gateDeploy?: boolean;
}

export interface CreateHealthCheckInput extends HealthCheckFields{
    port?: number;
    command?: string;
}

export interface UpdateHealthCheckInput extends HealthCheckFields{
    port?: number | null;
    command?: string | null;
}
