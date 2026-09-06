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

            return match ?? available[0] ?? null;
        });
    }, [key, available]);

    return [selected, select];
};
