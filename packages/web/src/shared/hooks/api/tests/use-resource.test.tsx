import { beforeEach, describe, expect, it, vi } from 'vitest';
import { renderHook } from '@/shared/tests/render-hook';
import { call } from '@/shared/api/call';
import { useResource } from '@/shared/hooks/api/use-resource';
import { queryCache } from '@/shared/hooks/api/query-cache';
import { get, post, del } from '@quantum/contracts/shared/routing';
import type { Endpoint } from '@quantum/contracts/shared/routing';

vi.mock('@/shared/api/call', () => ({ call: vi.fn() }));

const routes = {
    list: get<{ id: number; name: string }[]>('/project'),
    create: post<{ name: string }, { id: number }>('/project'),
    get: get<{ id: number; name: string }>('/project/:id'),
    remove: del('/project/:id')
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

interface StubOptions{
    path?: unknown;
    query?: unknown;
    fresh?: boolean;
}

const stubCall = (handler: (endpoint: Endpoint, options?: StubOptions) => Promise<unknown>): void => {
    vi.mocked(call).mockImplementation(
        (async (endpoint: Endpoint, options?: StubOptions) => handler(endpoint, options)) as unknown as never
    );
};

describe('useResource', () => {
    const callMock = vi.mocked(call);

    beforeEach(() => {
        callMock.mockReset();
        queryCache.reset();
    });

    it('loads the default list endpoint and exposes it with state', async () => {
        stubCall(async (endpoint) => {
            if(endpoint === routes.list) return [{ id: 1, name: 'a' }];
            throw new Error(`unexpected ${endpoint.path}`);
        });

        const harness = await renderHook(() => useResource(routes, { list: 'list' }));
        await settle(harness, (state) => !state.loading);

        expect(callMock).toHaveBeenCalledTimes(1);
        expect(harness.current.data).toEqual([{ id: 1, name: 'a' }]);
        expect(harness.current.error).toBeUndefined();
    });

    it('invalidates the whole segment after a write action and re-fetches forced', async () => {
        let state: { id: number; name: string }[] = [{ id: 1, name: 'a' }];

        stubCall(async (endpoint) => {
            if(endpoint === routes.remove) {
                state = [];
                return undefined;
            }
            if(endpoint === routes.list) return state;
            throw new Error(`unexpected ${endpoint.path}`);
        });
        callMock.mockClear();

        const harness = await renderHook(() => useResource(routes, { list: 'list' }));
        await settle(harness, (current) => !current.loading);
        expect(harness.current.data).toEqual([{ id: 1, name: 'a' }]);

        const removed = harness.current.remove({ path: { id: 1 } });
        await removed;
        await settle(harness, (current) => !current.loading);

        expect(harness.current.data).toEqual([]);
        const forced = callMock.mock.calls.filter(([, options]) => (options as StubOptions | undefined)?.fresh === true);
        expect(forced.length).toBeGreaterThan(0);
    });

    it('supports a scoped list via the request option and passes fresh on refresh', async () => {
        const seen: StubOptions[] = [];

        stubCall(async (_endpoint, options) => {
            seen.push(options ?? {});
            return ['scoped'];
        });

        const harness = await renderHook(() => useResource(routes, { list: 'list', request: { path: { orgId: 9 } } }));
        await settle(harness, (current) => !current.loading);

        expect(seen[0]).toEqual({ path: { orgId: 9 } });

        harness.current.refresh();
        await settle(harness, (current) => !current.loading);

        expect(seen[1]).toEqual({ path: { orgId: 9 }, fresh: true });
    });

    it('exposes action errors and pending state without touching the list', async () => {
        stubCall(async (endpoint) => {
            if(endpoint === routes.create) throw new Error('nope');
            throw new Error(`unexpected ${endpoint.path}`);
        });

        const harness = await renderHook(() => useResource(routes, { list: 'list', request: null }));
        let actionError: unknown;

        try{
            await harness.current.create({ body: { name: 'x' } });
        }catch(cause){
            actionError = cause;
        }

        await harness.flush();

        expect(actionError).toBeInstanceOf(Error);
        expect((actionError as Error).message).toBe('nope');
        expect(harness.current.pending).toBe(false);
        expect(harness.current.error?.message).toBe('nope');
        expect(harness.current.loading).toBe(false);
    });
});