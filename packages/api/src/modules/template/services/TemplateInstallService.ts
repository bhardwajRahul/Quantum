import { randomBytes } from 'node:crypto';
import Project from '@/modules/project/models/Project';
import Template from '../models/Template';
import SecretCipher from '@/shared/services/SecretCipher';
import { eventBus } from '@/shared/events/EventBus';
import TemplateInstall from '../models/TemplateInstall';
import TemplateService from './TemplateService';
import { TemplateInstallError } from '../contracts/domain/errors';
import type { Tenant } from '@/modules/organization/contracts/types/fastify';
import type { InstallTemplateInput } from '@quantum/contracts/modules/template/http';

export default class TemplateInstallService{
    #templates = new TemplateService();
    #cipher = new SecretCipher();

    async install(userId: number, tenant: Tenant, projectId: number, input: InstallTemplateInput): Promise<TemplateInstall>{
        const project = await this.#projectFor(tenant, projectId);
        const template = await this.#templates.get(tenant, input.templateId);
        const inputsEnc = this.#resolveInputs(template, input.inputs ?? {});

        const install = await TemplateInstall.create({
            templateId: template.id,
            templateVersion: template.version,
            name: input.name,
            organizationId: project.organizationId,
            projectId: project.id,
            environmentId: input.environmentId ?? null,
            userId,
            nodeId: process.env.NODE_ID ?? 'local',
            inputsEnc
        }).save();

        this.#startProvisioning(install, userId);
        return install;
    }

    #resolveInputs(template: Template, supplied: Record<string, string | number | boolean>): string | null{
        const resolved: Record<string, string> = {};

        for(const def of template.inputsSchema){
            let value: string | undefined;

            if(def.generate){
                value = randomBytes(def.generate === 'token' ? 32 : 24).toString('base64url');
            }else if(supplied[def.key] !== undefined){
                value = String(supplied[def.key]);
            }else if(def.default !== undefined){
                value = String(def.default);
            }

            if(value === undefined){
                if(def.required) throw TemplateInstallError.MissingInput(def.key);
                continue;
            }

            resolved[def.key] = value;
        }

        if(Object.keys(resolved).length === 0) return null;
        return this.#cipher.encrypt(JSON.stringify(resolved));
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
