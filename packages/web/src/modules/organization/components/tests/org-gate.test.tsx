import { afterEach, describe, expect, it, vi } from 'vitest';
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import OrgGate from '@/modules/organization/components/OrgGate';
import { organizationApi } from '@/modules/organization/api/api';
import { useTenantStore } from '@/shared/store/tenant';
import { ApiError } from '@/shared/services/ApiError';
import { OrganizationRole } from '@quantum/contracts/modules/organization/domain';
import type { ReactElement } from 'react';
import type { Root } from 'react-dom/client';
import type { Organization, TenantContext } from '@quantum/contracts/modules/organization/domain';

type ListCall = ReturnType<typeof organizationApi.list>;

const pendingList = (): ListCall =>
    new Promise<Organization[]>(() => undefined) as unknown as ListCall;

const organization = (id: number, name: string): Organization => ({
    id,
    name,
    slug: `${name}-slug`,
    isPersonal: false,
    ownerId: 1,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z'
});

const ORGS = [organization(1, 'personal')];
const CONTEXT: TenantContext = { organization: ORGS[0], role: OrganizationRole.Owner };

const gated = <OrgGate><p>protected content</p></OrgGate>;

let container: HTMLDivElement | undefined;
let root: Root | undefined;

const render = async (element: ReactElement) => {
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
    await act(async () => { root?.render(element); });
};

const settle = async () => {
    await act(async () => undefined);
    await act(async () => undefined);
    await act(async () => undefined);
};

afterEach(async () => {
    await act(async () => { root?.unmount(); });
    root = undefined;
    container?.remove();
    container = undefined;
    useTenantStore.getState().clear();
    vi.restoreAllMocks();
});

describe('OrgGate', () => {
    it('holds protected content while organizations load', async () => {
        vi.spyOn(organizationApi, 'list').mockReturnValue(pendingList());

        await render(gated);

        expect(container?.textContent).toContain('Preparing your workspace');
        expect(container?.textContent).not.toContain('protected content');
    });

    it('offers a create form when the user has no organizations', async () => {
        vi.spyOn(organizationApi, 'list').mockResolvedValue([]);

        await render(gated);
        await settle();

        expect(container?.textContent).toContain('Create an organization');
        expect(container?.textContent).toContain('Organization name');
        expect(container?.textContent).toContain('Create organization');
        expect(container?.textContent).not.toContain('protected content');
    });

    it('lets protected content through once an organization exists', async () => {
        vi.spyOn(organizationApi, 'list').mockResolvedValue(ORGS);
        vi.spyOn(organizationApi, 'current').mockResolvedValue(CONTEXT);

        await render(gated);
        await settle();

        expect(container?.textContent).toContain('protected content');
        expect(container?.textContent).not.toContain('Create an organization');
        expect(useTenantStore.getState().currentOrganizationId).toBe(1);
    });

    it('offers a retry when the organization list fails', async () => {
        vi.spyOn(organizationApi, 'list').mockRejectedValue(new ApiError(0, 'Network request failed'));

        await render(gated);
        await settle();

        expect(container?.textContent).toContain('Could not load organizations');
        expect(container?.textContent).toContain('Try again');
        expect(container?.textContent).not.toContain('protected content');
    });
});
