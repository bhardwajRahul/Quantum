import { create } from 'zustand';
import { createPersistentStore } from '@/shared/store/persistent';

export interface TenantState{
    currentOrganizationId: number | null;
    setOrganizationId: (organizationId: number) => void;
    clear: () => void;
}

const storage = createPersistentStore<number>(
    'qt-org',
    (organizationId) => String(organizationId),
    (stored) => {
        if(stored === null) return null;

        const parsed = Number(stored);
        return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
    }
);

export const useTenantStore = create<TenantState>((set) => ({
    currentOrganizationId: storage.read(),
    setOrganizationId: (organizationId) => {
        storage.write(organizationId);
        set({ currentOrganizationId: organizationId });
    },
    clear: () => {
        storage.write(null);
        set({ currentOrganizationId: null });
    }
}));

storage.subscribe((currentOrganizationId) => useTenantStore.setState({ currentOrganizationId }));
