import { beforeEach, describe, expect, it, vi } from 'vitest';
import { renderHook } from '@/shared/tests/render-hook';
import { call } from '@/shared/api/call';
import { useResource } from '@/shared/hooks/api/use-resource';
import { queryCache } from '@/shared/hooks/api/query-cache';
import { get, del } from '@quantum/contracts/shared/routing';
import type { Endpoint } from '@quantum/contracts/shared/routing';

vi.mock('@/shared/api/call', () => ({ call: vi.fn() }));
vi.mock('alova', async (importOriginal) => ({
    ...(await importOriginal<typeof import('alova')>()),
    invalidateCache: vi.fn(async () => undefined)
}));

interface Row{
    id: number;
    name: string;
}

const routes = {
    list: get<Row[]>('/thing'),
    remove: del('/thing/:id')
};

const flush = async (times = 8): Promise<void> => {
    for(let i = 0; i < times; i += 1) await Promise.resolve();
};

const settle = async <T,>(harness: { current: T }, until: (state: T) => boolean): Promise<T> => {
    await flush();
    const deadline = Date.now() + 2_000;
    while(!until(harness.current) && Date.now() < deadline) await flush(1);
    return harness.current;
};

describe('optimistic writes', () => {
    const callMock = vi.mocked(call);

    beforeEach(() => {
        callMock.mockReset();
        queryCache.reset();
    });

    const mount = async () => {
        const harness = await renderHook(() => useResource(routes, { list: 'list' }));
        await settle(harness, (state) => !state.loading);
        return harness;
    };

    it('drops the row before the request settles and keeps it dropped on success', async () => {
        let server: Row[] = [{ id: 1, name: 'a' }, { id: 2, name: 'b' }];
        let release: (() => void) | undefined;

        callMock.mockImplementation((async (endpoint: Endpoint) => {
            if(endpoint === routes.remove){
                await new Promise<void>((resolve) => { release = resolve; });
                server = server.filter((row) => row.id !== 1);
                return undefined;
            }
            if(endpoint === routes.list) return server;
            throw new Error(`unexpected ${endpoint.path}`);
        }) as unknown as never);

        const harness = await mount();
        expect(harness.current.data).toHaveLength(2);

        const pending = harness.current.remove(
            { path: { id: 1 } },
            (rows) => rows.filter((row) => row.id !== 1)
        );

        // The row is gone while the DELETE is still in flight.
        await settle(harness, (state) => (state.data ?? []).length === 1);
        expect(harness.current.data).toEqual([{ id: 2, name: 'b' }]);

        release?.();
        await pending;
        await settle(harness, (state) => !state.loading);
        expect(harness.current.data).toEqual([{ id: 2, name: 'b' }]);
    });

    it('puts the row back when the request is rejected', async () => {
        const server: Row[] = [{ id: 1, name: 'a' }, { id: 2, name: 'b' }];

        callMock.mockImplementation((async (endpoint: Endpoint) => {
            if(endpoint === routes.remove) throw new Error('Domain::Forbidden');
            if(endpoint === routes.list) return server;
            throw new Error(`unexpected ${endpoint.path}`);
        }) as unknown as never);

        const harness = await mount();
        expect(harness.current.data).toHaveLength(2);

        await harness.current.remove(
            { path: { id: 1 } },
            (rows) => rows.filter((row) => row.id !== 1)
        ).catch(() => undefined);

        await settle(harness, (state) => (state.data ?? []).length === 2);
        expect(harness.current.data).toEqual(server);
        expect(harness.current.error?.message).toBe('Domain::Forbidden');
    });

    it('patch exposes the same edit with its undo, for callers that own the dialog', async () => {
        callMock.mockImplementation((async (endpoint: Endpoint) => {
            if(endpoint === routes.list) return [{ id: 1, name: 'a' }, { id: 2, name: 'b' }];
            throw new Error(`unexpected ${endpoint.path}`);
        }) as unknown as never);

        const harness = await mount();

        const undo = harness.current.patch((rows) => rows.filter((row) => row.id !== 2));
        await settle(harness, (state) => (state.data ?? []).length === 1);
        expect(harness.current.data).toEqual([{ id: 1, name: 'a' }]);

        undo();
        await settle(harness, (state) => (state.data ?? []).length === 2);
        expect(harness.current.data).toEqual([{ id: 1, name: 'a' }, { id: 2, name: 'b' }]);
    });
});
