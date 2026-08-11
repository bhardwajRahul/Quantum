import { invalidateCache } from 'alova';
import { useTenantStore } from '@/shared/store/tenant';

export const isTenantReconfigure = (status: number, code: string): boolean =>
    status === 409 && code === 'Tenancy::OrganizationReconfigure';

export const reconfigureTenant = async () => {
    await invalidateCache();
    useTenantStore.getState().clear();
};
