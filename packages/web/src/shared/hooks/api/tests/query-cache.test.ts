import { beforeEach, describe, expect, it } from 'vitest';
import { renderHook } from '@/shared/tests/render-hook';
import { queryCache, useRegisteredLoader, useQueryStore } from '@/shared/hooks/api/query-cache';

describe('queryCache', () => {
    beforeEach(() => queryCache.reset());

    it('loads once per key and dedupes concurrent loads', async () => {
        let calls = 0;
        const cleanup = queryCache.registerLoader(['project', 'list'], () => {
            calls += 1;
            return new Promise<unknown>((resolve) => setTimeout(() => resolve([1, 2, 3]), 10));
        });

        try{
            await Promise.all([queryCache.load(['project', 'list']), queryCache.load(['project', 'list'])]);
        }finally{
            cleanup();
        }

        expect(calls).toBe(1);
    });

    it('surfaces loader errors as Error snapshots', async () => {
        const cleanup = queryCache.registerLoader(['project', 'list'], () => Promise.reject(new Error('boom')));

        try{
            await queryCache.load(['project', 'list']);
        }finally{
            cleanup();
        }

        const snapshot = queryCache.snapshot(['project', 'list']);
        expect(snapshot.status).toBe('error');
        expect(snapshot.error?.message).toBe('boom');
        expect(snapshot.data).toBeNull();
    });

    it('invalidates every key of a segment and forces the reload', async () => {
        const list = { calls: 0, fresh: false };
        const detail = { calls: 0, fresh: false };

        const cleanups = [
            queryCache.registerLoader(['project', 'list'], async (force) => {
                list.calls += 1;
                list.fresh = force ?? false;
                return ['a'];
            }),
            queryCache.registerLoader(['project', 'get', 7], async (force) => {
                detail.calls += 1;
                detail.fresh = force ?? false;
                return { id: 7 };
            }),
            queryCache.registerLoader(['repository', 'list'], async () => ['x'])
        ];

        try{
            await queryCache.load(['project', 'list']);
            await queryCache.load(['project', 'get', 7]);
            await queryCache.load(['repository', 'list']);

            await queryCache.invalidateSegment('project');
        }finally{
            cleanups.forEach((cleanup) => cleanup());
        }

        expect(list).toEqual({ calls: 2, fresh: true });
        expect(detail).toEqual({ calls: 2, fresh: true });
        expect(queryCache.snapshot(['repository', 'list']).data).toEqual(['x']);
    });

    it('keeps previous data visible while a forced refresh is in flight', async () => {
        let tick = 0;
        let resolveFirst: (() => void) | undefined;
        const gate = new Promise<void>((resolve) => {
            resolveFirst = resolve;
        });

        const cleanup = queryCache.registerLoader(['project', 'list'], async () => {
            tick += 1;
            if(tick === 1) await gate;
            return [`run-${tick}`];
        });

        try{
            const first = queryCache.load(['project', 'list']);
            await Promise.resolve();
            await Promise.resolve();

            const refresh = queryCache.refresh([['project', 'list']]);
            await Promise.resolve();
            await Promise.resolve();

            const done = await (async () => {
                resolveFirst?.();
                await first;
                await refresh;
                return queryCache.snapshot(['project', 'list']);
            })();

            expect(done.status).toBe('success');
            expect(done.data).toEqual(['run-2']);
        }finally{
            resolveFirst?.();
            cleanup();
        }
    });

    it('exposes snapshots to react through the store hook', async () => {
        const cleanup = queryCache.registerLoader(['project', 'list'], () => Promise.resolve(['hook']));
        try{
            await queryCache.load(['project', 'list']);
        }finally{
            cleanup();
        }

        const resolved = await renderHook(() => useQueryStore(['project', 'list']));
        expect(resolved.current.data).toEqual(['hook']);
        expect(resolved.current.status).toBe('success');

        const idle = await renderHook(() => useQueryStore(null));
        expect(idle.current.data).toBeNull();
    });

    it('stops refetching once the loader is unregistered', async () => {
        let calls = 0;

        const harness = await renderHook(() => {
            useRegisteredLoader(['project', 'list'], async () => {
                calls += 1;
                return [calls];
            });
            return useQueryStore(['project', 'list']);
        });

        await harness.flush();
        await queryCache.load(['project', 'list']);
        expect(harness.current.data).toEqual([1]);
        expect(calls).toBe(1);

        await harness.unmount();
        await queryCache.refresh([['project', 'list']]);

        expect(calls).toBe(1);
    });
});