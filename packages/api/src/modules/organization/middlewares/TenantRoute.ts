import { MiddlewareFn } from '@/shared/middlewares/Middleware';
import { AuthError } from '@/modules/auth/contracts/domain/errors';
import { UserRole } from '@quantum/contracts/modules/user/domain';
import { OrganizationRole } from '@quantum/contracts/modules/organization/domain';
import User from '@/modules/user/models/User';
import Organization from '../models/Organization';
import OrganizationMembership from '../models/OrganizationMembership';
import { TenancyError } from '../contracts/domain/errors';
import type { FastifyRequest } from 'fastify';

interface ResolvedTenant{
    organization: Organization | null;
    role: OrganizationRole;
}

const parseIdParam = (raw: string | undefined): number | null => {
    if(raw === undefined) return null;
    const value = Number(raw);
    return Number.isInteger(value) && value > 0 ? value : null;
};

const orgLevelMembership = (memberships: OrganizationMembership[], organizationId: number): OrganizationMembership | undefined =>
    memberships.find((membership) => membership.organizationId === organizationId && membership.projectId === null);

class TenantResolver{
    async resolve(req: FastifyRequest): Promise<void>{
        if(!req.principal) throw AuthError.Unauthorized();
        const user = await User.findOneBy({ id: req.principal.userId });
        if(!user) throw AuthError.Unauthorized();

        const isPlatformAdmin = user.role === UserRole.Admin;
        const memberships = await OrganizationMembership.find({ where: { userId: user.id } });
        const organizationIds = [...new Set(memberships.map((membership) => membership.organizationId))];
        const params = req.params as Record<string, string>;
        const paramOrgId = parseIdParam(params.orgId);
        const projectId = parseIdParam(params.projectId);

        const headerRaw = req.headers['x-organization-id'] as string | undefined;
        const headerOrgId = headerRaw ? parseIdParam(headerRaw) : null;
        if(paramOrgId === null && headerRaw && headerOrgId === null){
            throw TenancyError.OrganizationReconfigure();
        }

        const orgId = paramOrgId ?? headerOrgId;
        const resolved = orgId === null
            ? await this.resolveDefaultOrg(user.defaultOrganizationId, memberships, isPlatformAdmin)
            : await this.resolveExplicitOrg(orgId, paramOrgId === null, memberships, isPlatformAdmin, projectId);

        req.tenant = {
            organizationId: resolved.organization?.id ?? null,
            projectId,
            role: resolved.role,
            organizationIds,
            projectIds: this.projectIdsFor(resolved.organization ? [resolved.organization.id] : organizationIds),
            isPlatformAdmin
        };
    }

    private async resolveExplicitOrg(
        orgId: number,
        fromHeader: boolean,
        memberships: OrganizationMembership[],
        isPlatformAdmin: boolean,
        projectId: number | null
    ): Promise<ResolvedTenant>{
        const membership = orgLevelMembership(memberships, orgId);
        if(!membership && !isPlatformAdmin){
            throw fromHeader ? TenancyError.OrganizationReconfigure() : TenancyError.OrganizationForbidden();
        }

        const organization = await Organization.findOneBy({ id: orgId });
        if(!organization){
            throw fromHeader ? TenancyError.OrganizationReconfigure() : TenancyError.OrganizationNotFound();
        }

        let role = membership?.role ?? (isPlatformAdmin ? OrganizationRole.Owner : OrganizationRole.Viewer);
        if(projectId !== null){
            const override = memberships.find((membership) => membership.projectId === projectId);
            if(override) role = override.role;
        }
        return { organization, role };
    }

    private async resolveDefaultOrg(
        defaultOrganizationId: number | null,
        memberships: OrganizationMembership[],
        isPlatformAdmin: boolean
    ): Promise<ResolvedTenant>{
        let organization: Organization | null = null;
        let membership: OrganizationMembership | undefined;

        if(defaultOrganizationId !== null){
            membership = orgLevelMembership(memberships, defaultOrganizationId);
            organization = await Organization.findOneBy({ id: defaultOrganizationId });
            if(!organization && !isPlatformAdmin) throw TenancyError.OrganizationReconfigure();
        }

        const role = membership?.role
            ?? memberships.find((candidate) => candidate.projectId === null)?.role
            ?? (isPlatformAdmin ? OrganizationRole.Owner : OrganizationRole.Member);
        return { organization, role };
    }

    // The Project entity lands in a later wave; until then tenants have no project scope.
    private projectIdsFor(_organizationIds: number[]): number[]{
        return [];
    }
}

export const TenantRoute: MiddlewareFn = (req) => new TenantResolver().resolve(req);
