import { describe, expect, it } from 'vitest';
import { useApp } from '@tests/harness';
import { request, expectError } from '@tests/request';
import { seed } from '@tests/Seed';
import { serverRoutes } from '@quantum/contracts/modules/server/routes';

const ctx = useApp();

describe('server', () => {
    it('exposes health without authentication', async () => {
        const res = await request(ctx.app, serverRoutes.health);

        expect(res.status).toBe(200);
        const health = res.data();
        expect(health.serverStatus).toMatch(/^Server::Health::(Healthy|Overloaded)$/);
        expect(health.cpuStatus).toMatch(/^Server::Health::CPU::(Healthy|Overloaded)$/);
        expect(health.ramStatus).toMatch(/^Server::Health::RAM::(Healthy|Overloaded)$/);
        if(health.cpuStatus.endsWith('Healthy') && health.ramStatus.endsWith('Healthy')){
            expect(health.serverStatus).toBe('Server::Health::Healthy');
        }
        expect(health.cpuPercent).toBeGreaterThanOrEqual(0);
        expect(health.cpuPercent).toBeLessThanOrEqual(100);
        expect(health.ramPercent).toBeGreaterThanOrEqual(0);
        expect(health.ramPercent).toBeLessThanOrEqual(100);
        expect(health.memTotal).toBeGreaterThan(0);
        expect(health.memFree).toBeGreaterThan(0);
    });

    it('rejects unauthenticated public address requests', async () => {
        const res = await request(ctx.app, serverRoutes.publicAddress);

        expectError(res, 401, 'Authentication::Unauthorized');
    });

    it('tells authenticated users the address their published ports live on', async () => {
        const user = await seed.user();

        const res = await request(ctx.app, serverRoutes.publicAddress, { as: user.id });

        expect(res.status).toBe(200);
        expect(res.data().host.length).toBeGreaterThan(0);
    });
});
