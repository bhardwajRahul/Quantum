import { v4 } from 'uuid';
import slugify from 'slugify';
import { eventBus } from '@/shared/events/EventBus';
import { isUniqueViolation } from '@/shared/models/isUniqueViolation';
import Project from '../models/Project';
import Environment from '../models/Environment';
import { ProjectError } from '../contracts/domain/errors';
import type { Tenant } from '@/modules/organization/contracts/types/fastify';
import type { CreateProjectInput, UpdateProjectInput } from '@quantum/contracts/modules/project/http';

export default class ProjectService{
    async listForOrg(tenant: Tenant, orgId: number): Promise<Project[]>{
        if(!tenant.isPlatformAdmin && !tenant.organizationIds.includes(orgId)){
            throw ProjectError.Forbidden();
        }
        return Project.find({ where: { organizationId: orgId }, order: { id: 'ASC' } });
    }

    async create(userId: number, tenant: Tenant, orgId: number, input: CreateProjectInput): Promise<Project>{
        if(!tenant.isPlatformAdmin && !tenant.organizationIds.includes(orgId)){
            throw ProjectError.Forbidden();
        }

        try{
            const project = await Project.create({
                name: input.name,
                slug: this.#slug(input.name),
                organizationId: orgId
            }).save();

            eventBus.emit('project.created', {
                projectId: project.id,
                organizationId: project.organizationId,
                name: project.name
            });

            return project;
        }catch(error){
            if(isUniqueViolation(error)) throw ProjectError.SlugAlreadyTaken();
            throw error;
        }
    }

    async getOwned(tenant: Tenant, projectId: number): Promise<Project>{
        const project = await Project.findOneBy({ id: projectId });
        if(!project) throw ProjectError.NotFound();
        if(!tenant.isPlatformAdmin && !tenant.organizationIds.includes(project.organizationId)){
            throw ProjectError.Forbidden();
        }
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
