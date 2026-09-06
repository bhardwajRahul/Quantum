import { eventBus } from '@/shared/events/EventBus';
import { assertOrg } from '@/shared/tenancy';
import SecretCipher from '@/shared/services/SecretCipher';
import Project from '@/modules/project/models/Project';
import DockerContainer from '@/modules/docker/models/DockerContainer';
import ContainerOps from '@/modules/deployment/orchestrator/ContainerOps';
import RepositoryService from '@/modules/repository/services/RepositoryService';
import TemplateInstallService from '@/modules/template/services/TemplateInstallService';
import Codespace from '../models/Codespace';
import { CodespaceError } from '../contracts/domain/errors';
import { CodespaceStatus } from '@quantum/contracts/modules/codespace/domain';
import { ContainerDesiredState } from '@quantum/contracts/modules/docker/domain';
import type { Tenant } from '@/modules/organization/contracts/types/fastify';
import type { CodespaceAccess } from '@quantum/contracts/modules/codespace/domain';
import type { CreateCodespaceInput } from '@quantum/contracts/modules/codespace/http';

type WorkspaceTarget = { repositoryId: number } | { templateInstallId: number };

const IN_FLIGHT = new Set([CodespaceStatus.Pending, CodespaceStatus.Provisioning, CodespaceStatus.Running]);

export default class CodespaceService{
    #repositories = new RepositoryService();
    #installs = new TemplateInstallService();

    async forRepository(userId: number, tenant: Tenant, repositoryId: number): Promise<Codespace>{
        await this.#repositories.getOwned(userId, tenant, repositoryId);
        return this.#forTarget({ repositoryId });
    }

    async openForRepository(userId: number, tenant: Tenant, repositoryId: number): Promise<Codespace>{
        const repository = await this.#repositories.getOwned(userId, tenant, repositoryId);
        const container = await DockerContainer.findOneBy({ repositoryId: repository.id });
        if(!container || !container.storagePath) throw CodespaceError.TargetNotReady();

        const existing = await Codespace.findOneBy({ repositoryId: repository.id });
        if(existing) return this.#reopen(existing, userId);

        return this.#provision(await Codespace.create({
            name: `code-${repository.alias}`,
            organizationId: repository.organizationId ?? 0,
            projectId: repository.projectId,
            userId,
            repositoryId: repository.id,
            templateInstallId: null,
            status: CodespaceStatus.Pending
        }).save(), userId);
    }

    async forInstall(tenant: Tenant, installId: number): Promise<Codespace>{
        await this.#installs.get(tenant, installId);
        return this.#forTarget({ templateInstallId: installId });
    }

    async openForInstall(userId: number, tenant: Tenant, installId: number): Promise<Codespace>{
        const install = await this.#installs.get(tenant, installId);
        if(!install.services.some((service) => service.containerId !== null)) throw CodespaceError.TargetNotReady();

        const existing = await Codespace.findOneBy({ templateInstallId: install.id });
        if(existing) return this.#reopen(existing, userId);

        return this.#provision(await Codespace.create({
            name: `code-install-${install.id}`,
            organizationId: install.organizationId ?? 0,
            projectId: install.projectId,
            userId,
            repositoryId: null,
            templateInstallId: install.id,
            status: CodespaceStatus.Pending
        }).save(), userId);
    }

    async stop(tenant: Tenant, codespaceId: number): Promise<Codespace>{
        const codespace = await this.getOwned(tenant, codespaceId);
        const container = codespace.containerId === null ? null : await DockerContainer.findOneBy({ id: codespace.containerId });

        if(container){
            await new ContainerOps(container).stop();
            container.desiredState = ContainerDesiredState.Stopped;
            await container.save();
        }

        codespace.status = CodespaceStatus.Stopped;
        return codespace.save();
    }

    async removeForTarget(target: WorkspaceTarget): Promise<void>{
        const codespace = await Codespace.findOneBy(target);
        if(codespace) await this.#teardown(codespace, codespace.userId);
    }

    async #teardown(codespace: Codespace, userId: number): Promise<void>{
        const { id, containerId, networkId } = codespace;
        await codespace.remove();
        eventBus.emit('codespace.provisionRequested', { codespaceId: id, action: 'delete', userId, containerId, networkId });
    }

    async #forTarget(target: WorkspaceTarget): Promise<Codespace>{
        const codespace = await Codespace.findOneBy(target);
        if(!codespace) throw CodespaceError.NotFound();
        return codespace;
    }

    async #reopen(codespace: Codespace, userId: number): Promise<Codespace>{
        if(IN_FLIGHT.has(codespace.status)) return codespace;

        codespace.status = CodespaceStatus.Pending;
        await codespace.save();
        return this.#provision(codespace, userId);
    }

    #provision(codespace: Codespace, userId: number): Codespace{
        this.#requestProvision(codespace.id, 'create', userId);
        return codespace;
    }

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
            repositoryId: null,
            templateInstallId: null,
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
        assertOrg(tenant, codespace.organizationId, CodespaceError.Forbidden);
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
        await this.#teardown(codespace, userId);
    }

    #requestProvision(codespaceId: number, action: 'create' | 'delete', userId: number){
        eventBus.emit('codespace.provisionRequested', { codespaceId, action, userId });
    }

    async #projectFor(tenant: Tenant, projectId: number): Promise<Project>{
        const project = await Project.findOneBy({ id: projectId });
        if(!project) throw CodespaceError.NotFound();
        assertOrg(tenant, project.organizationId, CodespaceError.Forbidden);
        return project;
    }
}
