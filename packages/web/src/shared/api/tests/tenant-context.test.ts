import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { invalidateCache } from 'alova';
import { organizationApi } from '@/modules/organization/api/api';
import { useTenantStore } from '@/shared/store/tenant';
import { useSessionStore } from '@/shared/store/session';
import { capturedRequests as captured, respondWith, resetFetchStub } from '@/shared/tests/fetch-stub';
import { resetStores } from '@/shared/tests/store-reset';

beforeEach(async () => {
    resetFetchStub();
    resetStores();
    await invalidateCache();
});

afterEach(() => {
    resetStores();
    resetFetchStub();
});

describe('the organization header', () => {
    it('sends the selected organization with every request', async () => {
        respondWith(200, { data: [] });
        useTenantStore.getState().setOrganizationId(7);

        await organizationApi.list();

        expect(captured[0]?.headers.get('x-organization-id')).toBe('7');
    });

    it('omits the header when no organization is selected', async () => {
        respondWith(200, { data: [] });

        await organizationApi.list();

        expect(captured[0]?.headers.get('x-organization-id')).toBeNull();
    });
});

describe('a tenant reconfigure response', () => {
    it('clears the stored organization but keeps the session', async () => {
        useSessionStore.getState().setToken('a-token');
        useTenantStore.getState().setOrganizationId(7);
        respondWith(409, { error: 'Tenancy::OrganizationReconfigure' });

        await expect(organizationApi.remove({ path: { id: 7 } })).rejects.toThrow('Tenancy::OrganizationReconfigure');

        expect(useTenantStore.getState().currentOrganizationId).toBeNull();
        expect(localStorage.getItem('qt-org')).toBeNull();
        expect(useSessionStore.getState().token).toBe('a-token');
    });

    it('leaves the tenant untouched on unrelated failures', async () => {
        useTenantStore.getState().setOrganizationId(7);
        respondWith(403, { error: 'Tenancy::OrganizationForbidden' });

        await expect(organizationApi.remove({ path: { id: 7 } })).rejects.toThrow('Tenancy::OrganizationForbidden');

        expect(useTenantStore.getState().currentOrganizationId).toBe(7);
    });
});
