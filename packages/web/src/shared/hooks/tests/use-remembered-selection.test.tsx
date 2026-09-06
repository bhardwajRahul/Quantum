import { beforeEach, describe, expect, it } from 'vitest';
import { act } from 'react';
import { renderHook } from '@/shared/tests/render-hook';
import { useRememberedSelection } from '@/shared/hooks/use-remembered-selection';

const KEY = 'quantum.selection.test.repository';

const flush = async (): Promise<void> => {
    for(let i = 0; i < 6; i += 1) await act(async () => undefined);
};

beforeEach(() => {
    localStorage.clear();
});

describe('useRememberedSelection', () => {
    it('picks the first entry for a reader who has never chosen', async () => {
        const harness = await renderHook(() => useRememberedSelection('test.repository', [1, 2, 3]));
        await flush();

        expect(harness.current[0]).toBe(1);
    });

    it('restores the last selection, which is the point of it', async () => {
        localStorage.setItem(KEY, '2');

        const harness = await renderHook(() => useRememberedSelection('test.repository', [1, 2, 3]));
        await flush();

        expect(harness.current[0]).toBe(2);
    });

    it('persists a new selection for the next visit', async () => {
        const harness = await renderHook(() => useRememberedSelection('test.repository', [1, 2, 3]));
        await flush();

        await act(async () => { harness.current[1](3); });
        await flush();

        expect(harness.current[0]).toBe(3);
        expect(localStorage.getItem(KEY)).toBe('3');
    });

    it('falls back to the first entry when the stored one is gone', async () => {
        localStorage.setItem(KEY, '99');

        const harness = await renderHook(() => useRememberedSelection('test.repository', [1, 2, 3]));
        await flush();

        expect(harness.current[0]).toBe(1);
    });

    it('waits for the list before deciding', async () => {
        localStorage.setItem(KEY, '2');

        const harness = await renderHook(() => useRememberedSelection('test.repository', []));
        await flush();

        expect(harness.current[0]).toBeNull();
        expect(localStorage.getItem(KEY)).toBe('2');
    });

    it('keeps a selection the reader just made even as the list settles', async () => {
        const harness = await renderHook(() => useRememberedSelection('test.repository', [1, 2]));
        await flush();

        await act(async () => { harness.current[1](1); });
        await flush();

        expect(harness.current[0]).toBe(1);
    });
});
