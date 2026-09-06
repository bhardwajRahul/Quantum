import { useEffect, useRef, useState } from 'react';
import type { AutosaveApi, SaveState, UseAutosaveOptions } from '@/shared/contracts/form';

const DEFAULT_DELAY_MS = 700;

export const useAutosave = <T>({
    value,
    save,
    enabled = true,
    delayMs = DEFAULT_DELAY_MS,
    canSave
}: UseAutosaveOptions<T>): AutosaveApi => {
    const [state, setState] = useState<SaveState>('idle');

    const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const savingRef = useRef(false);
    const savedRef = useRef(JSON.stringify(value));
    const valueRef = useRef(value);
    const saveRef = useRef(save);
    const canSaveRef = useRef(canSave);
    const enabledRef = useRef(enabled);

    valueRef.current = value;
    saveRef.current = save;
    canSaveRef.current = canSave;
    enabledRef.current = enabled;

    const clearTimer = () => {
        if(timerRef.current === null) return;
        clearTimeout(timerRef.current);
        timerRef.current = null;
    };

    const isSavable = (input: T): boolean => canSaveRef.current === undefined || canSaveRef.current(input);

    const commit = (input: T) => {
        savedRef.current = JSON.stringify(input);
        savingRef.current = true;
        setState('saving');

        Promise.resolve()
            .then(() => saveRef.current(input))
            .then(() => setState('saved'), () => {
                savedRef.current = '';
                setState('error');
            })
            .finally(() => {
                savingRef.current = false;
            });
    };

    const flush = () => {
        clearTimer();
        if(!enabledRef.current) return;

        const current = valueRef.current;
        if(JSON.stringify(current) === savedRef.current) return;

        if(!isSavable(current)){
            setState('pending');
            return;
        }

        if(savingRef.current){
            timerRef.current = setTimeout(flush, delayMs);
            return;
        }

        commit(current);
    };

    const flushRef = useRef(flush);
    flushRef.current = flush;

    const serialized = JSON.stringify(value);

    useEffect(() => {
        if(!enabled || serialized === savedRef.current) return;

        setState('pending');
        clearTimer();
        timerRef.current = setTimeout(() => flushRef.current(), delayMs);

        return () => {
            if(timerRef.current === null) return;
            clearTimeout(timerRef.current);
            timerRef.current = null;
        };
    }, [enabled, delayMs, serialized]);

    useEffect(() => () => {
        clearTimer();
        if(!enabledRef.current || savingRef.current) return;

        const current = valueRef.current;
        if(JSON.stringify(current) === savedRef.current || !isSavable(current)) return;

        savedRef.current = JSON.stringify(current);
        void Promise.resolve().then(() => saveRef.current(current));
    }, []);

    return { state, flush };
};
