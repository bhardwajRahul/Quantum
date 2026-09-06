import ContainerOps from '../ContainerOps';
import { HealthCheckType } from '@quantum/contracts/modules/health-check/domain';
import type HealthCheck from '@/modules/health-check/models/HealthCheck';

export interface ProbeResult{
    ok: boolean;
    latencyMs: number;
    error?: string;
}

export const runProbe = async (container: ContainerOps, healthCheck: HealthCheck): Promise<ProbeResult> => {
    const started = Date.now();
    try{
        const argv = buildProbeCommand(healthCheck);
        if(!argv) return { ok: false, latencyMs: Date.now() - started, error: 'HealthCheck::Command::Missing' };
        const result = await container.executeCommand(argv);
        return {
            ok: result.exitCode === 0,
            latencyMs: Date.now() - started,
            error: result.exitCode === 0 ? undefined : (result.error ?? `exit ${result.exitCode}`)
        };
    }catch(error){
        return { ok: false, latencyMs: Date.now() - started, error: (error as Error).message || String(error) };
    }
};

const buildProbeCommand = (healthCheck: HealthCheck): string[] | null => {
    switch(healthCheck.type){
        case HealthCheckType.Http: {
            const port = healthCheck.port ?? 80;
            const reqPath = healthCheck.path && healthCheck.path.startsWith('/') ? healthCheck.path : `/${healthCheck.path || ''}`;
            return ['wget', '-q', '-T', String(healthCheck.timeoutSec || 5), '-O', '-', `http://localhost:${port}${reqPath}`];
        }
        case HealthCheckType.Tcp: {
            const port = healthCheck.port ?? 80;
            return ['nc', '-z', '-w', String(healthCheck.timeoutSec || 5), 'localhost', String(port)];
        }
        case HealthCheckType.Cmd:
            return healthCheck.command ? ['sh', '-c', healthCheck.command] : null;
        default:
            return null;
    }
};
