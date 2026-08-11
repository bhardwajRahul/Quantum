import { isUniqueViolation } from '@/shared/models/isUniqueViolation';
import ProjectService from './ProjectService';
import Environment from '../models/Environment';
import { EnvironmentError } from '../contracts/domain/errors';
import type { Tenant } from '@/modules/organization/contracts/types/fastify';
import type { CreateEnvironmentInput, UpdateEnvironmentInput } from '@quantum/contracts/modules/project/http';

export default class EnvironmentService{
    #projects = new ProjectService();

    async listForProject(tenant: Tenant, projectId: number): Promise<Environment[]>{
        const project = await this.#projects.getOwned(tenant, projectId);
        return Environment.find({ where: { projectId: project.id }, order: { id: 'ASC' } });
    }

    async create(tenant: Tenant, projectId: number, input: CreateEnvironmentInput): Promise<Environment>{
        const project = await this.#projects.getOwned(tenant, projectId);

        try{
            return await Environment.create({
                name: input.name,
                type: input.type,
                projectId: project.id,
                organizationId: project.organizationId
            }).save();
        }catch(error){
            if(isUniqueViolation(error)) throw EnvironmentError.NameAlreadyTaken();
            throw error;
        }
    }

    async getOwned(tenant: Tenant, environmentId: number): Promise<Environment>{
        const environment = await Environment.findOneBy({ id: environmentId });
        if(!environment) throw EnvironmentError.NotFound();
        await this.#projects.getOwned(tenant, environment.projectId);
        return environment;
    }

    async update(tenant: Tenant, environmentId: number, input: UpdateEnvironmentInput): Promise<Environment>{
        const environment = await this.getOwned(tenant, environmentId);
        if(input.name !== undefined) environment.name = input.name;
        if(input.type !== undefined) environment.type = input.type;

        try{
            return await environment.save();
        }catch(error){
            if(isUniqueViolation(error)) throw EnvironmentError.NameAlreadyTaken();
            throw error;
        }
    }

    async remove(tenant: Tenant, environmentId: number): Promise<void>{
        const environment = await this.getOwned(tenant, environmentId);
        await environment.remove();
    }
}
