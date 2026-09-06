import { create } from 'zustand';
import { createPersistentStore } from '@/shared/store/persistent';

export interface SidebarState{
    collapsed: boolean;
    toggle: () => void;
}

const storage = createPersistentStore<boolean>(
    'quantum.sidebar',
    (collapsed) => String(collapsed),
    (stored) => (stored === 'true' ? true : stored === 'false' ? false : null)
);

export const useSidebarStore = create<SidebarState>((set, get) => ({
    collapsed: storage.read() ?? false,
    toggle: () => {
        const collapsed = !get().collapsed;
        storage.write(collapsed);
        set({ collapsed });
    }
}));
