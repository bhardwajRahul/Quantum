import { describe, expect, it, vi } from 'vitest';
import { act } from 'react';
import { useQuery } from '@/shared/hooks/api/use-query';
import { deferred, renderHook } from '@/shared/tests/render-hook';
import type { Query } from '@/shared/contracts/api';

const idleQuery = <T,>(state: Partial<Query<T>> = {}): Query<T> => ({
    data: null,
    loading: false,
    error: undefined,
    reload: vi.fn(),
    ...state
});

describe('useQuery', () => {
    it('requests on mount and reports loading until the payload lands', async () => {
        const gate = deferred<number[]>();
        const request = vi.fn(() => gate.promise);

        const query = await renderHook(() => useQuery(request));
        expect(query.current.loading).toBe(true);
        expect(query.current.data).toBeNull();

        gate.resolve([1, 2]);
        await query.flush();

        expect(query.current).toMatchObject({ data: [1, 2], loading: false, error: undefined });
        expect(request).toHaveBeenCalledTimes(1);
    });

    it('stays idle while an argument is missing and runs as soon as it arrives', async () => {
        const request = vi.fn((organizationId: number) => Promise.resolve([`course-${organizationId}`]));
        let organizationId: number | undefined;

        const query = await renderHook(() => useQuery(request, [organizationId]));
        expect(request).not.toHaveBeenCalled();
        expect(query.current).toMatchObject({ data: null, loading: false });

        organizationId = 7;
        await query.render();

        expect(request).toHaveBeenCalledWith(7);
        expect(query.current.data).toEqual(['course-7']);
    });

    it('waits on a dependency and inherits its failure without requesting', async () => {
        const request = vi.fn((id: number) => Promise.resolve(id));
        const reload = vi.fn();
        let organization = idleQuery<{ id: number }>({ loading: true });

        const query = await renderHook(() => useQuery(request, [organization.data?.id], { dependsOn: organization }));
        expect(query.current.loading).toBe(true);

        const failure = new Error('organization unreachable');
        organization = idleQuery<{ id: number }>({ error: failure, reload });
        await query.render();

        expect(query.current).toMatchObject({ loading: false, error: failure, data: null });
        expect(request).not.toHaveBeenCalled();

        await act(async () => query.current.reload());
        expect(reload).toHaveBeenCalledTimes(1);
    });

    it('honours `enabled` as a gate and runs once it opens', async () => {
        const request = vi.fn(() => Promise.resolve('me'));
        let token: string | null = null;

        const query = await renderHook(() => useQuery(request, [], { enabled: !!token }));
        expect(request).not.toHaveBeenCalled();
        expect(query.current.loading).toBe(false);

        token = 'jwt';
        await query.render();

        expect(request).toHaveBeenCalledTimes(1);
        expect(query.current.data).toBe('me');
    });

    it('exposes the payload through `select`', async () => {
        const request = () => Promise.resolve([{ id: 3 }, { id: 4 }]);

        const query = await renderHook(() => useQuery(request, [], { select: (organizations) => organizations[0] ?? null }));
        await query.flush();

        expect(query.current.data).toEqual({ id: 3 });
    });

    it('refetches when the arguments change and drops the response of the previous run', async () => {
        const gates = new Map([[1, deferred<string>()], [2, deferred<string>()]]);
        const request = vi.fn((id: number) => gates.get(id)!.promise);
        let id = 1;

        const query = await renderHook(() => useQuery(request, [id]));
        id = 2;
        await query.render();

        gates.get(2)!.resolve('second');
        await query.flush();
        expect(query.current.data).toBe('second');

        gates.get(1)!.resolve('first');
        await query.flush();
        expect(query.current.data).toBe('second');
        expect(request).toHaveBeenCalledTimes(2);
    });

    it('does not refetch when only the request identity changes', async () => {
        const calls = vi.fn();
        const query = await renderHook(() => useQuery((_id: number) => {
            calls();
            return Promise.resolve('stable');
        }, [1]));

        await query.render();
        await query.render();

        expect(calls).toHaveBeenCalledTimes(1);
        expect(query.current.data).toBe('stable');
    });

    it('keeps the current payload on screen while a reload revalidates it', async () => {
        const gates = [deferred<string>(), deferred<string>()];
        let attempt = 0;
        const request = (_id: number) => gates[attempt++]!.promise;

        const query = await renderHook(() => useQuery(request, [1]));
        gates[0]!.resolve('first');
        await query.flush();

        await act(async () => query.current.reload());
        expect(query.current).toMatchObject({ data: 'first', loading: true });

        gates[1]!.resolve('second');
        await query.flush();
        expect(query.current).toMatchObject({ data: 'second', loading: false });
    });

    it('surfaces a failure and recovers on reload', async () => {
        const gates = [deferred<string>(), deferred<string>()];
        let attempt = 0;
        const request = (_id: number) => gates[attempt++]!.promise;

        const query = await renderHook(() => useQuery(request, [1]));
        gates[0]!.reject(new Error('boom'));
        await query.flush();

        expect(query.current).toMatchObject({ data: null, loading: false });
        expect(query.current.error?.message).toBe('boom');

        await act(async () => query.current.reload());
        gates[1]!.resolve('recovered');
        await query.flush();

        expect(query.current).toMatchObject({ data: 'recovered', error: undefined, loading: false });
    });

    it('ignores a response that lands after the component is gone', async () => {
        const gate = deferred<string>();
        const query = await renderHook(() => useQuery((_id: number) => gate.promise, [1]));

        await query.unmount();
        gate.resolve('late');

        await expect(gate.promise).resolves.toBe('late');
    });
});
