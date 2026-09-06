import type { OrganizationRole } from '@quantum/contracts/modules/organization/domain';

export interface OrganizationFields{
    name: string;
    slug: string;
    ownerId: number;
    isPersonal: boolean;
    createdAt: Date;
    updatedAt: Date;
}

export interface MembershipFields{
    userId: number;
    organizationId: number;
    projectId: number | null;
    role: OrganizationRole;
    createdAt: Date;
    updatedAt: Date;
}
