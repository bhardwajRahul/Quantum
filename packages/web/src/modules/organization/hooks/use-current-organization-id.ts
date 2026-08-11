import { useTenantStore } from '@/shared/store/tenant';

export const useCurrentOrganizationId = (): number | null =>
    useTenantStore((state) => state.currentOrganizationId);
