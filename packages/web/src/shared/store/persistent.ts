export interface PersistentStorage<T>{
    read: () => T | null;
    write: (value: T | null) => void;
    subscribe: (listener: (value: T | null) => void) => () => void;
}

export const createPersistentStore = <T>(
    key: string,
    serialize: (value: T) => string,
    parse: (stored: string | null) => T | null
): PersistentStorage<T> => {
    const read = (): T | null => {
        try{
            return parse(localStorage.getItem(key));
        }catch{
            return null;
        }
    };

    const write = (value: T | null) => {
        try{
            if(value === null) localStorage.removeItem(key);
            else localStorage.setItem(key, serialize(value));
        }catch{
            return;
        }
    };

    const subscribe = (listener: (value: T | null) => void): (() => void) => {
        if(typeof window === 'undefined') return () => undefined;

        const onStorage = (event: StorageEvent) => {
            if(event.key !== null && event.key !== key) return;
            listener(read());
        };

        window.addEventListener('storage', onStorage);
        return () => window.removeEventListener('storage', onStorage);
    };

    return { read, write, subscribe };
};
