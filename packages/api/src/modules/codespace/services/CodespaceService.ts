import { eventBus } from '@/shared/events/EventBus';
import SecretCipher from '@/shared/services/SecretCipher';
import Project from '@/modules/project/models/Project';
import Codespace from '../models/Codespace';
import { CodespaceError } from '../contracts/domain/errors';
import { CodespaceStatus } from '@quantum/contracts/modules/codespace/domain';
import type { Tenant } from '@/modules/organization/contracts/types/fastify';
import type { CodespaceAccess } from '@quantum/contracts/modules/codespace/domain';
import type { CreateCodespaceInput } from '@quantum/contracts/modules/codespace/http';

export default class CodespaceService{
    async listForProject(tenant: Tenant, projectId: number): Promise<Codespace[]>{
        const project = await this.#projectFor(tenant, projectId);
        return Codespace.find({ where: { projectId: project.id }, order: { id: 'ASC' } });
    }

    async create(userId: number, tenant: Tenant, projectId: number, input: CreateCodespaceInput): Promise<Codespace>{
        const project = await this.#projectFor(tenant, projectId);
        const codespace = await Codespace.create({
            name: input.name.trim(),
            organizationId: project.organizationId,
            projectId: project.id,
            userId,
            cpuCores: input.cpuCores ?? 1,
            memoryMb: input.memoryMb ?? 2048,
            diskGb: input.diskGb ?? 10,
            status: CodespaceStatus.Pending
        }).save();

        this.#requestProvision(codespace.id, 'create', userId);
        return codespace;
    }

    async getOwned(tenant: Tenant, codespaceId: number): Promise<Codespace>{
        const codespace = await Codespace.findOneBy({ id: codespaceId });
        if(!codespace) throw CodespaceError.NotFound();
        if(!tenant.isPlatformAdmin && !tenant.organizationIds.includes(codespace.organizationId)){
            throw CodespaceError.Forbidden();
        }
        return codespace;
    }

    async access(tenant: Tenant, codespaceId: number): Promise<CodespaceAccess>{
        const codespace = await this.getOwned(tenant, codespaceId);
        if(!codespace.accessUrl || !codespace.passwordEnc) throw CodespaceError.ProvisionFailed();
        return {
            accessUrl: codespace.accessUrl,
            password: new SecretCipher().decrypt(codespace.passwordEnc)
        };
    }

    async remove(userId: number, tenant: Tenant, codespaceId: number): Promise<void>{
        const codespace = await this.getOwned(tenant, codespaceId);
        const removedId = codespace.id;
        await codespace.remove();
        this.#requestProvision(removedId, 'delete', userId);
    }

    #requestProvision(codespaceId: number, action: 'create' | 'delete', userId: number){
        eventBus.emit('codespace.provisionRequested', { codespaceId, action, userId });
    }

    async #projectFor(tenant: Tenant, projectId: number): Promise<Project>{
        const project = await Project.findOneBy({ id: projectId });
        if(!project) throw CodespaceError.NotFound();
        if(!tenant.isPlatformAdmin && !tenant.organizationIds.includes(project.organizationId)){
            throw CodespaceError.Forbidden();
        }
        return project;
    }
}
