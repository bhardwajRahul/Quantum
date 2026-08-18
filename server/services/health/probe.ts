import DockerContainerService from '@services/docker/container';
import { IHealthCheck, HealthStatus } from '@typings/models/healthCheck';

export interface ProbeResult{
    ok: boolean;
    latencyMs: number;
    error?: string;
}

export const runProbe = async (
    containerService: DockerContainerService,
    healthCheck: IHealthCheck
): Promise<ProbeResult> => {
    const started = Date.now();
    try{
        let argv: string[];
        switch(healthCheck.type){
            case 'http': {
                const port = healthCheck.port || 80;
                const reqPath = healthCheck.path && healthCheck.path.startsWith('/')
                    ? healthCheck.path
                    : `/${healthCheck.path || ''}`;
                const timeout = String(healthCheck.timeoutSec || 5);
                argv = ['wget', '-q', '-T', timeout, '-O', '-', `http://localhost:${port}${reqPath}`];
                break;
            }
            case 'tcp': {
                const port = healthCheck.port || 80;
                argv = ['nc', '-z', '-w', String(healthCheck.timeoutSec || 5), 'localhost', String(port)];
                break;
            }
            case 'cmd': {
                if(!healthCheck.command){
                    return { ok: false, latencyMs: Date.now() - started, error: 'HealthCheck::Command::Missing' };
                }

                const result = await containerService.executeCommand(healthCheck.command);
                return {
                    ok: result.exitCode === 0,
                    latencyMs: Date.now() - started,
                    error: result.exitCode === 0 ? undefined : (result.error || `exit ${result.exitCode}`)
                };
            }
            default:
                return { ok: false, latencyMs: Date.now() - started, error: 'HealthCheck::Type::Unknown' };
        }

        const result = await containerService.executeCommand(argv);
        return {
            ok: result.exitCode === 0,
            latencyMs: Date.now() - started,
            error: result.exitCode === 0 ? undefined : (result.error || `exit ${result.exitCode}`)
        };
    }catch(error: any){
        return { ok: false, latencyMs: Date.now() - started, error: error?.message || String(error) };
    }
};

export interface HysteresisState{
    status: HealthStatus;
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
    let { status } = state;
    let consecutiveFailures = state.consecutiveFailures;
    let consecutiveSuccesses = state.consecutiveSuccesses;

    if(ok){
        consecutiveSuccesses += 1;
        consecutiveFailures = 0;
    }else{
        consecutiveFailures += 1;
        consecutiveSuccesses = 0;
    }

    let next: HealthStatus = status;
    if(ok && consecutiveSuccesses >= Math.max(1, healthyThreshold)){
        next = 'healthy';
    }else if(!ok && consecutiveFailures >= Math.max(1, unhealthyThreshold)){
        next = 'unhealthy';
    }

    return {
        status: next,
        consecutiveFailures,
        consecutiveSuccesses,
        transitioned: next !== status
    };
};

export default runProbe;
