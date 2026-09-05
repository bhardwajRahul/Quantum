import { useCallback, useEffect, useState } from 'react';
import { createPersistentStore } from '@/shared/store/persistent';

type SelectionId = string | number;

const storeFor = (key: string) => createPersistentStore<SelectionId>(
    `quantum.selection.${key}`,
    (value) => String(value),
    (stored) => {
        if(stored === null) return null;
        const asNumber = Number(stored);
        return Number.isInteger(asNumber) && stored.trim() !== '' ? asNumber : stored;
    }
);

/**
 * Remembers which project or repository the reader last picked on a page, so coming back
 * lands on it instead of an empty selector — and picks the first one for a reader who has
 * never chosen, so the page shows something rather than a prompt to choose.
 *
 * The stored id is only restored while it is still one of `available`: a project that
 * has since been deleted would otherwise leave the page pinned to something the server
 * no longer knows about, with no way to tell from the UI why it is empty. `available`
 * being empty means the list has not loaded yet, so the choice is left pending rather
 * than resolved against nothing.
 */
export const useRememberedSelection = <T extends SelectionId>(
    key: string,
    available: readonly T[]
): [T | null, (value: T | null) => void] => {
    const [selected, setSelected] = useState<T | null>(null);

    const select = useCallback((value: T | null) => {
        storeFor(key).write(value);
        setSelected(value);
    }, [key]);

    useEffect(() => {
        if(available.length === 0) return;

        setSelected((current) => {
            if(current !== null && available.includes(current)) return current;

            const remembered = storeFor(key).read();
            const match = available.find((candidate) => candidate === remembered);

            // Falling back to the first entry rather than `null`: a page whose whole
            // content depends on a selection has nothing to show without one.
            return match ?? available[0] ?? null;
        });
    }, [key, available]);

    return [selected, select];
};
