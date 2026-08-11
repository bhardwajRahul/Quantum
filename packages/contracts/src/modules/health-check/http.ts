import type { HealthCheckType } from './domain';

export interface CreateHealthCheckInput{
    type?: HealthCheckType;
    path?: string;
    /**
     * @type uint
     * @minimum 1
     * @maximum 65535
     */
    port?: number;
    command?: string;
    /**
     * @type uint
     * @minimum 5
     * @maximum 3600
     */
    intervalSec?: number;
    /**
     * @type uint
     * @minimum 1
     * @maximum 120
     */
    timeoutSec?: number;
    /**
     * @type uint
     * @minimum 1
     * @maximum 20
     */
    healthyThreshold?: number;
    /**
     * @type uint
     * @minimum 1
     * @maximum 20
     */
    unhealthyThreshold?: number;
    enabled?: boolean;
    autoRestart?: boolean;
    gateDeploy?: boolean;
}

export interface UpdateHealthCheckInput{
    type?: HealthCheckType;
    path?: string;
    /**
     * @type uint
     * @minimum 1
     * @maximum 65535
     */
    port?: number | null;
    command?: string | null;
    /**
     * @type uint
     * @minimum 5
     * @maximum 3600
     */
    intervalSec?: number;
    /**
     * @type uint
     * @minimum 1
     * @maximum 120
     */
    timeoutSec?: number;
    /**
     * @type uint
     * @minimum 1
     * @maximum 20
     */
    healthyThreshold?: number;
    /**
     * @type uint
     * @minimum 1
     * @maximum 20
     */
    unhealthyThreshold?: number;
    enabled?: boolean;
    autoRestart?: boolean;
    gateDeploy?: boolean;
}
