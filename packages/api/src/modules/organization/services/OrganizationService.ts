import { In, IsNull } from 'typeorm';
import { v4 } from 'uuid';
import slugify from 'slugify';
import User from '@/modules/user/models/User';
import Project from '@/modules/project/models/Project';
import { eventBus } from '@/shared/events/EventBus';
import { OrganizationRole } from '@quantum/contracts/modules/organization/domain';
import Organization from '../models/Organization';
import OrganizationMembership from '../models/OrganizationMembership';
import { TenancyError } from '../contracts/domain/errors';
import type { Tenant } from '../contracts/types/fastify';
import type { TenantContext } from '@quantum/contracts/modules/organization/domain';
import type { CreateOrganizationInput, UpdateOrganizationInput } from '@quantum/contracts/modules/organization/http';

const DEFAULT_PROJECT_NAME = 'Default Environment';

export default class OrganizationService{
    async listForTenant(tenant: Tenant): Promise<Organization[]>{
        if(tenant.isPlatformAdmin) return Organization.find({ order: { id: 'ASC' } });
        if(tenant.organizationIds.length === 0) return [];
        return Organization.find({ where: { id: In(tenant.organizationIds) }, order: { id: 'ASC' } });
    }

    async create(ownerId: number, input: CreateOrganizationInput): Promise<Organization>{
        const organization = await Organization.create({
            name: input.name,
            slug: this.#slug(input.name),
            ownerId
        }).save();

        await OrganizationMembership.create({
            userId: ownerId,
            organizationId: organization.id,
            projectId: null,
            role: OrganizationRole.Owner
        }).save();

        await this.#assignDefaultOrganization(ownerId, organization.id);

        const project = await Project.create({
            name: DEFAULT_PROJECT_NAME,
            slug: this.#slug(DEFAULT_PROJECT_NAME),
            organizationId: organization.id,
            isDefault: true
        }).save();

        eventBus.emit('organization.created', {
            organizationId: organization.id,
            ownerId,
            name: organization.name
        });

        eventBus.emit('project.created', {
            projectId: project.id,
            organizationId: project.organizationId,
            name: project.name
        });

        return organization;
    }

    async get(orgId: number): Promise<Organization>{
        const organization = await Organization.findOneBy({ id: orgId });
        if(!organization) throw TenancyError.OrganizationNotFound();
        return organization;
    }

    async update(orgId: number, input: UpdateOrganizationInput): Promise<Organization>{
        const organization = await this.get(orgId);
        if(input.name !== undefined) organization.name = input.name;
        return organization.save();
    }

    async remove(orgId: number): Promise<void>{
        const organization = await this.get(orgId);
        await OrganizationMembership.delete({ organizationId: orgId });
        await organization.remove();

        eventBus.emit('organization.deleted', { organizationId: orgId });
    }

    async currentFor(userId: number, tenant: Tenant): Promise<TenantContext>{
        if(tenant.organizationId === null) throw TenancyError.OrganizationNotFound();
        const organization = await this.get(tenant.organizationId);
        const membership = await OrganizationMembership.findOneBy({
            userId,
            organizationId: organization.id,
            projectId: IsNull()
        });

        return {
            organization: {
                id: organization.id,
                name: organization.name,
                slug: organization.slug,
                isPersonal: organization.isPersonal,
                ownerId: organization.ownerId,
                createdAt: organization.createdAt.toISOString(),
                updatedAt: organization.updatedAt.toISOString()
            },
            role: membership?.role ?? tenant.role
        };
    }

    async #assignDefaultOrganization(userId: number, organizationId: number): Promise<void>{
        const user = await User.findOneBy({ id: userId });
        if(!user || user.defaultOrganizationId !== null) return;

        user.defaultOrganizationId = organizationId;
        await user.save();
    }

    #slug(name: string): string{
        return `${slugify(name, { lower: true, strict: true })}-${v4().slice(0, 4)}`;
    }
}
