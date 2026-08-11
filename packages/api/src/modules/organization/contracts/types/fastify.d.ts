import type { OrganizationRole } from '@quantum/contracts/modules/organization/domain';

export interface Tenant{
    organizationId: number | null;
    projectId: number | null;
    role: OrganizationRole;
    organizationIds: number[];
    projectIds: number[];
    isPlatformAdmin: boolean;
}

declare module 'fastify'{
    interface FastifyRequest{
        tenant?: Tenant;
    }
}
