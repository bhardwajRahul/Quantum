import { describe, expect, it, vi } from 'vitest';
import { act } from 'react';
import { useMutation } from '@/shared/hooks/api/use-mutation';
import { deferred, renderHook } from '@/shared/tests/render-hook';

interface Written{
    id: number;
}

describe('useMutation', () => {
    it('tracks the write and notifies the caller on success', async () => {
        const gate = deferred<Written>();
        const request = vi.fn((title: string) => {
            expect(title).toBe('note');
            return gate.promise;
        });
        const onSuccess = vi.fn();

        const mutation = await renderHook(() => useMutation(request, { onSuccess }));
        expect(mutation.current.loading).toBe(false);

        let payload: Promise<Written> | undefined;
        await act(async () => {
            payload = mutation.current.run('note');
        });
        expect(mutation.current.loading).toBe(true);

        gate.resolve({ id: 1 });
        await mutation.flush();

        await expect(payload).resolves.toEqual({ id: 1 });
        expect(onSuccess).toHaveBeenCalledWith({ id: 1 });
        expect(mutation.current).toMatchObject({ loading: false, error: undefined });
    });

    it('keeps the failure and still rejects so a form can show it', async () => {
        const failure = new Error('title taken');
        const mutation = await renderHook(() => useMutation(() => Promise.reject(failure)));

        await expect(act(async () => mutation.current.run())).rejects.toBe(failure);
        await mutation.flush();

        expect(mutation.current).toMatchObject({ loading: false, error: failure });
    });
});
