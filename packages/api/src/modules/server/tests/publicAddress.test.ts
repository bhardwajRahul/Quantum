import { afterEach, describe, expect, it, vi } from 'vitest';

const settings = { publicHost: '' as string | undefined, domain: 'http://localhost:7080' };

vi.mock('@/shared/config', () => ({ config: settings }));

const load = async () => (await import('@/modules/deployment/orchestrator/publicAddress')).publicAddress;

describe('publicAddress', () => {
    afterEach(() => { vi.resetModules(); });

    it('prefers the host configured in PUBLIC_HOST', async () => {
        settings.publicHost = '203.0.113.10';
        expect(await (await load())()).toBe('203.0.113.10');
    });

    it('falls back to the host of DOMAIN when PUBLIC_HOST is empty', async () => {
        settings.publicHost = '';
        expect(await (await load())()).toBe('localhost');
    });
});
