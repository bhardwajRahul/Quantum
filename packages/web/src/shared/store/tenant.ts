import { create } from 'zustand';
import type { TenantState } from '@/shared/contracts/routing/tenant';
import { readOrganizationId, writeOrganizationId } from '@/shared/utils/tenant';

export const useTenantStore = create<TenantState>((set) => ({
    currentOrganizationId: readOrganizationId(),
    setOrganizationId: (organizationId) => {
        writeOrganizationId(organizationId);
        set({ currentOrganizationId: organizationId });
    },
    clear: () => {
        writeOrganizationId(null);
        set({ currentOrganizationId: null });
    }
}));
