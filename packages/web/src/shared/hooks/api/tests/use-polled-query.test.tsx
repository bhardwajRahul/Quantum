import { afterEach, describe, expect, it, vi } from 'vitest';
import { act } from 'react';
import { useQuery } from '@/shared/hooks/api/use-query';
import { usePolledQuery } from '@/shared/hooks/api/use-polled-query';
import { renderHook } from '@/shared/tests/render-hook';

interface Progress{
    pending: number;
}

const EVERY_MS = 2000;

const poll = (request: () => Promise<Progress>) => renderHook(() => usePolledQuery(
    useQuery(request),
    {
        while: (progress) => progress.pending > 0,
        everyMs: EVERY_MS
    }
));

describe('usePolledQuery', () => {
    afterEach(() => {
        vi.useRealTimers();
        vi.restoreAllMocks();
    });

    it('reads once when the payload reports nothing pending', async () => {
        const request = vi.fn(() => Promise.resolve({ pending: 0 }));
        vi.useFakeTimers();

        const harness = await poll(request);
        await act(async () => { await vi.advanceTimersByTimeAsync(EVERY_MS * 4); });

        expect(request).toHaveBeenCalledTimes(1);
        await harness.unmount();
    });

    it('stops on its own when the payload settles, with no request after the last one', async () => {
        let pending = 1;
        const request = vi.fn(() => Promise.resolve({ pending }));
        vi.useFakeTimers();

        const harness = await poll(request);
        await act(async () => { await vi.advanceTimersByTimeAsync(EVERY_MS * 2); });
        expect(request.mock.calls.length).toBeGreaterThan(1);

        pending = 0;
        await act(async () => { await vi.advanceTimersByTimeAsync(EVERY_MS * 2); });
        const afterSettling = request.mock.calls.length;

        await act(async () => { await vi.advanceTimersByTimeAsync(EVERY_MS * 5); });

        expect(request.mock.calls.length).toBe(afterSettling);
        expect(harness.current.data).toEqual({ pending: 0 });
        await harness.unmount();
    });

    it('stops polling when the caller unmounts', async () => {
        const request = vi.fn(() => Promise.resolve({ pending: 3 }));
        vi.useFakeTimers();

        const harness = await poll(request);
        await act(async () => { await vi.advanceTimersByTimeAsync(EVERY_MS * 2); });
        const polled = request.mock.calls.length;
        expect(polled).toBeGreaterThan(1);

        await harness.unmount();
        await act(async () => { await vi.advanceTimersByTimeAsync(EVERY_MS * 4); });

        expect(request.mock.calls.length).toBe(polled);
    });

    it('returns the query it was given, untouched', async () => {
        const request = vi.fn(() => Promise.resolve({ pending: 0 }));

        const harness = await poll(request);

        expect(harness.current.loading).toBe(false);
        expect(harness.current.error).toBeUndefined();
        expect(typeof harness.current.reload).toBe('function');
        await harness.unmount();
    });
});
