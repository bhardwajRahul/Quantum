import { describe, expect, it } from 'vitest';
import { relaunchScript } from '@/modules/deployment/orchestrator/ContainerOps';

describe('relaunchScript', () => {
    const script = relaunchScript('npm run preview');

    it('stops the previous instance before starting a new one', () => {
        const kill = script.indexOf('kill -TERM');
        const start = script.indexOf('setsid');

        expect(kill).toBeGreaterThanOrEqual(0);
        expect(kill).toBeLessThan(start);
    });

    it('signals the process group, not just the launched command', () => {
        expect(script).toContain('kill -TERM -"$(cat /app/.quantum/app.pid)"');
    });

    it('starts the new instance in its own session, so it has a group to signal later', () => {
        expect(script).toContain("setsid sh -c 'exec npm run preview >> /proc/1/fd/1 2>&1' &");
    });

    it('records the new pid where the next deployment will look for it', () => {
        expect(script.trimEnd().endsWith('echo $! > /app/.quantum/app.pid')).toBe(true);
    });

    it('sends both streams to the container log', () => {
        expect(script).toContain('>> /proc/1/fd/1 2>&1');
    });

    it('survives a first deployment, when no pid has been recorded yet', () => {
        expect(script).toContain('if [ -f /app/.quantum/app.pid ]');
        expect(script).toContain('2>/dev/null || true');
    });
});
