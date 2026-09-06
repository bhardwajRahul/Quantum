import { useEffect } from 'react';
import { organizationApi } from '@/modules/organization/api/api';
import { useCurrentOrganizationId } from '@/modules/organization/hooks/use-current-organization-id';
import { useQuery } from '@/shared/hooks/api/use-query';
import { useTenantStore } from '@/shared/store/tenant';
import type { Organization, OrganizationRole } from '@quantum/contracts/modules/organization/domain';

export interface Tenancy{
    organizations: Organization[];
    current: Organization | null;
    role: OrganizationRole | null;
    loading: boolean;
    error: Error | undefined;
    reload: () => void;
}

const listOrganizations = (_organizationId: number | null) => organizationApi.list();

const currentContext = (_organizationId: number) => organizationApi.current();

const matchCurrent = (organizations: Organization[], organizationId: number | null): Organization | null =>
    organizations.find((organization) => organization.id === organizationId) ?? organizations[0] ?? null;

export const useTenancy = (): Tenancy => {
    const organizationId = useCurrentOrganizationId();
    const setOrganizationId = useTenantStore((state) => state.setOrganizationId);

    const list = useQuery(listOrganizations, [organizationId]);
    const organizations = list.data ?? [];
    const current = matchCurrent(organizations, organizationId);

    const context = useQuery(currentContext, [current?.id], { enabled: current !== null, dependsOn: list });

    useEffect(() => {
        if(current !== null && current.id !== organizationId) setOrganizationId(current.id);
    }, [current, organizationId, setOrganizationId]);

    const role = context.data !== null && current !== null && context.data.organization.id === current.id
        ? context.data.role
        : null;

    return {
        organizations,
        current,
        role,
        loading: list.loading,
        error: list.error,
        reload: list.reload
    };
};
