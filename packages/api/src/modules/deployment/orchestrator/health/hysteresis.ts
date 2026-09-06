import { HealthCheckStatus } from '@quantum/contracts/modules/health-check/domain';

export interface HysteresisState{
    status: HealthCheckStatus;
    consecutiveFailures: number;
    consecutiveSuccesses: number;
}

export interface HysteresisResult extends HysteresisState{
    transitioned: boolean;
}

export const evaluateHealthTransition = (
    state: HysteresisState,
    ok: boolean,
    healthyThreshold: number,
    unhealthyThreshold: number
): HysteresisResult => {
    const status = state.status;
    let consecutiveFailures = state.consecutiveFailures;
    let consecutiveSuccesses = state.consecutiveSuccesses;

    if(ok){
        consecutiveSuccesses += 1;
        consecutiveFailures = 0;
    }else{
        consecutiveFailures += 1;
        consecutiveSuccesses = 0;
    }

    let next: HealthCheckStatus = status;
    if(ok && consecutiveSuccesses >= Math.max(1, healthyThreshold)){
        next = HealthCheckStatus.Healthy;
    }else if(!ok && consecutiveFailures >= Math.max(1, unhealthyThreshold)){
        next = HealthCheckStatus.Unhealthy;
    }

    return { status: next, consecutiveFailures, consecutiveSuccesses, transitioned: next !== status };
};
