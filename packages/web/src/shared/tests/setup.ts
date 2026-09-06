import { createElement } from 'react';
import { vi } from 'vitest';

vi.mock('monaco-editor', () => ({}));

vi.mock('@monaco-editor/react', () => ({
    default: (props: { language?: string; value?: string; options?: { ariaLabel?: string } }) =>
        createElement('textarea', {
            'data-monaco': props.language ?? '',
            'aria-label': props.options?.ariaLabel,
            readOnly: true,
            value: props.value ?? ''
        }),
    loader: { config: () => undefined }
}));

(globalThis as Record<string, unknown>).IS_REACT_ACT_ENVIRONMENT = true;

const memoryStorage = (): Storage => {
    const entries = new Map<string, string>();

    return {
        get length(){
            return entries.size;
        },
        key: (index: number) => [...entries.keys()][index] ?? null,
        getItem: (key: string) => entries.get(key) ?? null,
        setItem: (key: string, value: string) => {
            entries.set(key, String(value));
        },
        removeItem: (key: string) => {
            entries.delete(key);
        },
        clear: () => {
            entries.clear();
        }
    };
};

if(typeof globalThis.localStorage?.getItem !== 'function'){
    Object.defineProperty(globalThis, 'localStorage', { value: memoryStorage(), configurable: true });
}
