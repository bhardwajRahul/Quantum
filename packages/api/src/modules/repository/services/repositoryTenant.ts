import { In } from 'typeorm';
import User from '@/modules/user/models/User';
import OrganizationMembership from '@/modules/organization/models/OrganizationMembership';
import Project from '@/modules/project/models/Project';
import { AuthError } from '@/modules/auth/contracts/domain/errors';
import { OrganizationRole } from '@quantum/contracts/modules/organization/domain';
import { UserRole } from '@quantum/contracts/modules/user/domain';
import type { Tenant } from '@/modules/organization/contracts/types/fastify';

const roleOf = (memberships: OrganizationMembership[], organizationId: number | null): OrganizationRole =>
    memberships.find((membership) =>
        membership.organizationId === organizationId && membership.projectId === null
    )?.role ?? OrganizationRole.Member;

const projectIdsOf = async (organizationIds: number[]): Promise<number[]> => {
    if(organizationIds.length === 0) return [];

    const projects = await Project.find({ where: { organizationId: In(organizationIds) }, select: { id: true } });
    return projects.map((project) => project.id);
};

export const repositoryTenantOf = async (userId: number): Promise<Tenant> => {
    const user = await User.findOneBy({ id: userId });
    if(!user) throw AuthError.Unauthorized();

    const memberships = await OrganizationMembership.find({ where: { userId } });
    const organizationIds = [...new Set(memberships.map((membership) => membership.organizationId))];

    return {
        organizationId: user.defaultOrganizationId,
        projectId: null,
        role: roleOf(memberships, user.defaultOrganizationId),
        organizationIds,
        projectIds: await projectIdsOf(organizationIds),
        isPlatformAdmin: user.role === UserRole.Admin
    };
};
