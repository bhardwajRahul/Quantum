import { afterEach, describe, expect, it, vi } from 'vitest';
import { resetStores } from '@/shared/tests/store-reset';

const KEY = 'qt-org';

const loadStore = async () => {
    vi.resetModules();
    const { useTenantStore } = await import('@/shared/store/tenant');
    return useTenantStore;
};

afterEach(() => {
    resetStores();
    vi.resetModules();
});

describe('the tenant store', () => {
    it('hydrates an empty selection when nothing is stored', async () => {
        const store = await loadStore();

        expect(store.getState().currentOrganizationId).toBeNull();
    });

    it('hydrates the persisted organization id synchronously', async () => {
        localStorage.setItem(KEY, '7');
        const store = await loadStore();

        expect(store.getState().currentOrganizationId).toBe(7);
    });

    it('ignores stored values that are not positive integers', async () => {
        localStorage.setItem(KEY, 'not-an-id');
        const store = await loadStore();

        expect(store.getState().currentOrganizationId).toBeNull();
    });

    it('persists the selected organization id', async () => {
        const store = await loadStore();

        store.getState().setOrganizationId(12);

        expect(store.getState().currentOrganizationId).toBe(12);
        expect(localStorage.getItem(KEY)).toBe('12');
    });

    it('clears the selection and the persisted key', async () => {
        localStorage.setItem(KEY, '7');
        const store = await loadStore();

        store.getState().clear();

        expect(store.getState().currentOrganizationId).toBeNull();
        expect(localStorage.getItem(KEY)).toBeNull();
    });
});
