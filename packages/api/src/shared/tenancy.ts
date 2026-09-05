import type { Tenant } from '@/modules/organization/contracts/types/fastify';

export const assertOrg = (tenant: Tenant, organizationId: number, fail: () => Error): void => {
    if(!tenant.isPlatformAdmin && !tenant.organizationIds.includes(organizationId)) throw fail();
};

export const assertProject = (tenant: Tenant, projectId: number, fail: () => Error): void => {
    if(!tenant.isPlatformAdmin && !tenant.projectIds.includes(projectId)) throw fail();
};
