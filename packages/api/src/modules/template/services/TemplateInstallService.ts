import Project from '@/modules/project/models/Project';
import { eventBus } from '@/shared/events/EventBus';
import TemplateInstall from '../models/TemplateInstall';
import TemplateService from './TemplateService';
import { TemplateInstallError } from '../contracts/domain/errors';
import type { Tenant } from '@/modules/organization/contracts/types/fastify';
import type { InstallTemplateInput } from '@quantum/contracts/modules/template/http';

export default class TemplateInstallService{
    #templates = new TemplateService();

    async install(userId: number, tenant: Tenant, projectId: number, input: InstallTemplateInput): Promise<TemplateInstall>{
        const project = await this.#projectFor(tenant, projectId);
        const template = await this.#templates.get(tenant, input.templateId);

        const install = await TemplateInstall.create({
            templateId: template.id,
            templateVersion: template.version,
            name: input.name,
            organizationId: project.organizationId,
            projectId: project.id,
            environmentId: input.environmentId ?? null,
            userId,
            nodeId: process.env.NODE_ID ?? 'local'
        }).save();

        this.#startProvisioning(install, userId);
        return install;
    }

    async listForProject(tenant: Tenant, projectId: number): Promise<TemplateInstall[]>{
        if(!tenant.isPlatformAdmin){
            const project = await Project.findOneBy({ id: projectId });
            if(!project || !this.#inCallerOrg(project, tenant)) throw TemplateInstallError.Forbidden();
        }
        return TemplateInstall.find({ where: { projectId }, order: { id: 'ASC' } });
    }

    async get(tenant: Tenant, id: number): Promise<TemplateInstall>{
        const install = await TemplateInstall.findOneBy({ id });
        if(!install) throw TemplateInstallError.NotFound();
        await this.#assertProjectVisible(tenant, install.projectId);
        return install;
    }

    async remove(tenant: Tenant, id: number): Promise<void>{
        const install = await TemplateInstall.findOneBy({ id });
        if(!install) throw TemplateInstallError.NotFound();
        await this.#assertProjectVisible(tenant, install.projectId);
        await install.remove();
    }

    #startProvisioning(install: TemplateInstall, userId: number){
        eventBus.emit('template.installed', {
            templateInstallId: install.id,
            projectId: install.projectId,
            templateId: install.templateId,
            userId
        });
    }

    async #projectFor(tenant: Tenant, projectId: number): Promise<Project>{
        const project = await Project.findOneBy({ id: projectId });
        if(!project) throw TemplateInstallError.NotFound();
        if(!tenant.isPlatformAdmin && !this.#inCallerOrg(project, tenant)) throw TemplateInstallError.Forbidden();
        return project;
    }

    async #assertProjectVisible(tenant: Tenant, projectId: number): Promise<void>{
        if(tenant.isPlatformAdmin) return;
        const project = await Project.findOneBy({ id: projectId });
        if(!project || !this.#inCallerOrg(project, tenant)) throw TemplateInstallError.NotFound();
    }

    #inCallerOrg(project: Project, tenant: Tenant): boolean{
        return tenant.organizationIds.includes(project.organizationId);
    }
}
