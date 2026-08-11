import { create } from 'zustand';
import type { SessionState } from '@/shared/contracts/routing/session';
import { readToken, writeToken } from '@/shared/utils/session';

export const useSessionStore = create<SessionState>((set) => ({
    token: readToken(),
    setToken: (token) => {
        writeToken(token);
        set({ token });
    },
    clear: () => {
        writeToken(null);
        set({ token: null });
    }
}));
