import { create } from 'zustand';
import { createPersistentStore } from '@/shared/store/persistent';

export interface SessionState{
    token: string | null;
    setToken: (token: string | null) => void;
    clear: () => void;
}

const storage = createPersistentStore<string>('quantum.session', (token) => token, (stored) => stored);

export const useSessionStore = create<SessionState>((set) => ({
    token: storage.read(),
    setToken: (token) => {
        storage.write(token);
        set({ token });
    },
    clear: () => {
        storage.write(null);
        set({ token: null });
    }
}));

storage.subscribe((token) => useSessionStore.setState({ token }));
