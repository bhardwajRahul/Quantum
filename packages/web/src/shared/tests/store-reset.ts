import { vi } from 'vitest';
import { useTenantStore } from '@/shared/store/tenant';
import { useSessionStore } from '@/shared/store/session';
import { queryCache } from '@/shared/hooks/api/query-cache';

export const resetStores = (): void => {
    useTenantStore.getState().clear();
    useSessionStore.getState().clear();
    localStorage.clear();
    queryCache.reset();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
};
