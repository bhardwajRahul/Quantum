import { v4 } from 'uuid';
import slugify from 'slugify';
import { eventBus } from '@/shared/events/EventBus';
import { saveOrConflict } from '@/shared/models/isUniqueViolation';
import { assertOrg } from '@/shared/tenancy';
import Project from '../models/Project';
import Environment from '../models/Environment';
import { ProjectError } from '../contracts/domain/errors';
import type { Tenant } from '@/modules/organization/contracts/types/fastify';
import type { CreateProjectInput, UpdateProjectInput } from '@quantum/contracts/modules/project/http';

export default class ProjectService{
    async listForOrg(tenant: Tenant, orgId: number): Promise<Project[]>{
        assertOrg(tenant, orgId, ProjectError.Forbidden);
        return Project.find({ where: { organizationId: orgId }, order: { id: 'ASC' } });
    }

    async create(userId: number, tenant: Tenant, orgId: number, input: CreateProjectInput): Promise<Project>{
        assertOrg(tenant, orgId, ProjectError.Forbidden);

        const project = await saveOrConflict(Project.create({
            name: input.name,
            slug: this.#slug(input.name),
            organizationId: orgId
        }).save(), ProjectError.SlugAlreadyTaken);

        eventBus.emit('project.created', {
            projectId: project.id,
            organizationId: project.organizationId,
            name: project.name
        });

        return project;
    }

    async getOwned(tenant: Tenant, projectId: number): Promise<Project>{
        const project = await Project.findOneBy({ id: projectId });
        if(!project) throw ProjectError.NotFound();
        assertOrg(tenant, project.organizationId, ProjectError.Forbidden);
        return project;
    }

    async update(tenant: Tenant, projectId: number, input: UpdateProjectInput): Promise<Project>{
        const project = await this.getOwned(tenant, projectId);
        if(input.name !== undefined) project.name = input.name;
        return project.save();
    }

    async remove(tenant: Tenant, projectId: number): Promise<void>{
        const project = await this.getOwned(tenant, projectId);
        await Environment.delete({ projectId: project.id });
        await project.remove();

        eventBus.emit('project.deleted', {
            projectId: project.id,
            organizationId: project.organizationId
        });
    }

    #slug(name: string): string{
        return `${slugify(name, { lower: true, strict: true })}-${v4().slice(0, 4)}`;
    }
}
