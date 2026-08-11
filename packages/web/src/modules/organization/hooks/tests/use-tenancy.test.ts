import { afterEach, describe, expect, it, vi } from 'vitest';
import { useTenancy } from '@/modules/organization/hooks/use-tenancy';
import { organizationApi } from '@/modules/organization/api/api';
import { useTenantStore } from '@/shared/store/tenant';
import { ApiError } from '@/shared/services/ApiError';
import { renderHook } from '@/shared/tests/render-hook';
import { OrganizationRole } from '@quantum/contracts/modules/organization/domain';
import type { HookHarness } from '@/shared/tests/render-hook';
import type { Tenancy } from '@/modules/organization/hooks/use-tenancy';
import type { Organization, TenantContext } from '@quantum/contracts/modules/organization/domain';

const organization = (id: number, name: string): Organization => ({
    id,
    name,
    slug: `${name}-slug`,
    isPersonal: false,
    ownerId: 1,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z'
});

const ORGS = [organization(1, 'personal'), organization(2, 'acme')];

const contextOf = (organization: Organization, role: OrganizationRole): TenantContext => ({ organization, role });

const answerWith = (organizations: Organization[], context: TenantContext) => {
    vi.spyOn(organizationApi, 'list').mockResolvedValue(organizations);
    vi.spyOn(organizationApi, 'current').mockResolvedValue(context);
};

let harness: HookHarness<Tenancy> | undefined;

const settle = async () => {
    await harness?.flush();
    await harness?.flush();
    await harness?.flush();
};

const tenancy = async () => {
    harness = await renderHook(() => useTenancy());
    await settle();
    return harness;
};

describe('useTenancy', () => {
    afterEach(async () => {
        await harness?.unmount();
        harness = undefined;
        useTenantStore.getState().clear();
        vi.restoreAllMocks();
    });

    it('keeps the stored organization when it is in the list', async () => {
        useTenantStore.getState().setOrganizationId(2);
        answerWith(ORGS, contextOf(ORGS[1], OrganizationRole.Admin));

        const hook = await tenancy();

        expect(hook.current.organizations).toHaveLength(2);
        expect(hook.current.current?.id).toBe(2);
        expect(useTenantStore.getState().currentOrganizationId).toBe(2);
    });

    it('falls back to the first organization when the stored one is missing', async () => {
        useTenantStore.getState().setOrganizationId(99);
        answerWith(ORGS, contextOf(ORGS[0], OrganizationRole.Owner));

        const hook = await tenancy();

        expect(hook.current.current?.id).toBe(1);
        expect(useTenantStore.getState().currentOrganizationId).toBe(1);
    });

    it('selects the first organization when nothing is stored', async () => {
        answerWith(ORGS, contextOf(ORGS[0], OrganizationRole.Member));

        const hook = await tenancy();

        expect(hook.current.current?.id).toBe(1);
        expect(useTenantStore.getState().currentOrganizationId).toBe(1);
    });

    it('reports an empty tenancy when the user has no organizations', async () => {
        useTenantStore.getState().setOrganizationId(2);
        answerWith([], contextOf(ORGS[0], OrganizationRole.Member));

        const hook = await tenancy();

        expect(hook.current.organizations).toEqual([]);
        expect(hook.current.current).toBeNull();
        expect(hook.current.role).toBeNull();
        expect(hook.current.error).toBeUndefined();
    });

    it('exposes the caller role from the tenant context', async () => {
        useTenantStore.getState().setOrganizationId(1);
        answerWith(ORGS, contextOf(ORGS[0], OrganizationRole.Admin));

        const hook = await tenancy();

        expect(hook.current.role).toBe(OrganizationRole.Admin);
    });

    it('hides the role while the tenant context points at another organization', async () => {
        useTenantStore.getState().setOrganizationId(2);
        answerWith(ORGS, contextOf(ORGS[0], OrganizationRole.Admin));

        const hook = await tenancy();

        expect(hook.current.current?.id).toBe(2);
        expect(hook.current.role).toBeNull();
    });

    it('surfaces the organization list failure', async () => {
        vi.spyOn(organizationApi, 'list').mockRejectedValue(new ApiError(0, 'Network request failed'));

        const hook = await tenancy();

        expect(hook.current.error).toBeInstanceOf(Error);
        expect(hook.current.current).toBeNull();
    });
});
