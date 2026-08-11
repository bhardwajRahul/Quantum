import { act } from 'react';
import { createRoot } from 'react-dom/client';

export interface HookHarness<T>{
    readonly current: T;
    render: () => Promise<void>;
    flush: () => Promise<void>;
    unmount: () => Promise<void>;
}

export const renderHook = async <T,>(hook: () => T): Promise<HookHarness<T>> => {
    let value: T | undefined;

    const Probe = () => {
        value = hook();
        return null;
    };

    const container = document.createElement('div');
    document.body.appendChild(container);
    const root = createRoot(container);

    const render = () => act(async () => {
        root.render(<Probe />);
    });

    await render();

    return {
        get current(){
            return value as T;
        },
        render,
        flush: () => act(async () => undefined),
        unmount: () => act(async () => {
            root.unmount();
        })
    };
};

export const deferred = <T,>() => {
    let resolve: ((value: T) => void) | undefined;
    let reject: ((cause: unknown) => void) | undefined;

    const promise = new Promise<T>((resolveFn, rejectFn) => {
        resolve = resolveFn;
        reject = rejectFn;
    });

    promise.catch(() => undefined);

    return {
        promise,
        resolve: (value: T) => resolve?.(value),
        reject: (cause: unknown) => reject?.(cause)
    };
};
