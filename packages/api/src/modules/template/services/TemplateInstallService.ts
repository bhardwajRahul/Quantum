import { randomBytes } from 'node:crypto';
import { In } from 'typeorm';
import Project from '@/modules/project/models/Project';
import DockerContainer from '@/modules/docker/models/DockerContainer';
import ContainerOps from '@/modules/deployment/orchestrator/ContainerOps';
import { repositoryTenantOf } from '@/modules/repository/services/repositoryTenant';
import { containerAddresses } from '@/modules/docker/services/containerAddress';
import { ContainerDesiredState } from '@quantum/contracts/modules/docker/domain';
import { TemplateInstallStatus } from '@quantum/contracts/modules/template/domain';
import Template from '../models/Template';
import SecretCipher from '@/shared/services/SecretCipher';
import { eventBus } from '@/shared/events/EventBus';
import TemplateInstall from '../models/TemplateInstall';
import TemplateService from './TemplateService';
import { composeToSpec } from './composeSpec';
import { installInputs, installSpec, serviceEnvironment } from './installEnvironment';
import { TemplateInstallError } from '../contracts/domain/errors';
import type { Tenant } from '@/modules/organization/contracts/types/fastify';
import type {
    CreateComposeInstallInput,
    InstallTemplateInput,
    TemplateInstallOperation,
    UpdateComposeInput,
    UpdateTemplateInstallEnvironmentInput
} from '@quantum/contracts/modules/template/http';
import type {
    TemplateInstall as TemplateInstallPayload,
    TemplateInstallEnvironment,
    TemplateSpec
} from '@quantum/contracts/modules/template/domain';

export default class TemplateInstallService{
    #templates = new TemplateService();
    #cipher = new SecretCipher();

    async install(userId: number, tenant: Tenant, projectId: number, input: InstallTemplateInput): Promise<TemplateInstallPayload>{
        const project = await this.#projectFor(tenant, projectId);
        const template = await this.#templates.get(tenant, input.templateId);
        const inputsEnc = this.#resolveInputs(template, input.inputs ?? {});

        const install = await TemplateInstall.create({
            templateId: template.id,
            compose: null,
            spec: null,
            name: input.name,
            organizationId: project.organizationId,
            projectId: project.id,
            userId,
            nodeId: process.env.NODE_ID ?? 'local',
            inputsEnc,
            environment: {}
        }).save();

        this.#startProvisioning(install, userId);
        return this.present(install);
    }

    async createCompose(userId: number, tenant: Tenant, projectId: number, input: CreateComposeInstallInput): Promise<TemplateInstallPayload>{
        const project = await this.#projectFor(tenant, projectId);
        const spec = composeToSpec(input.compose);

        const install = await TemplateInstall.create({
            templateId: null,
            compose: input.compose,
            spec,
            name: input.name,
            organizationId: project.organizationId,
            projectId: project.id,
            userId,
            nodeId: process.env.NODE_ID ?? 'local',
            inputsEnc: null,
            environment: {}
        }).save();

        this.#startProvisioning(install, userId);
        return this.present(install);
    }

    async updateCompose(tenant: Tenant, id: number, input: UpdateComposeInput): Promise<TemplateInstallPayload>{
        const install = await this.get(tenant, id);
        if(!install.compose) throw TemplateInstallError.NotCompose();

        install.spec = composeToSpec(input.compose);
        install.compose = input.compose;
        await install.save();
        return this.present(install);
    }

    async redeploy(userId: number, tenant: Tenant, id: number): Promise<TemplateInstallPayload>{
        const install = await this.get(tenant, id);
        install.status = TemplateInstallStatus.Pending;
        await install.save();

        this.#startProvisioning(install, userId);
        return this.present(install);
    }

    async environment(tenant: Tenant, id: number): Promise<TemplateInstallEnvironment>{
        const install = await this.get(tenant, id);
        const spec = await this.#specOf(install);
        const inputs = installInputs(install);

        return {
            installId: install.id,
            services: Object.entries(spec.services ?? {}).map(([name, service]) => ({
                name,
                environmentVariables: serviceEnvironment(install, name, service, inputs)
            }))
        };
    }

    async updateEnvironment(tenant: Tenant, id: number, input: UpdateTemplateInstallEnvironmentInput): Promise<TemplateInstallPayload>{
        const install = await this.get(tenant, id);
        const spec = await this.#specOf(install);

        for(const name of Object.keys(input.environment)){
            if(!(name in (spec.services ?? {}))) throw TemplateInstallError.UnknownService(name);
        }

        install.environment = input.environment;
        await install.save();
        return this.present(install);
    }

    async present(install: TemplateInstall): Promise<TemplateInstallPayload>{
        const [payload] = await this.#presentAll([install]);
        return payload;
    }

    async #presentAll(installs: TemplateInstall[]): Promise<TemplateInstallPayload[]>{
        const addresses = await containerAddresses(installs.flatMap((install) => install.services.map((service) => service.containerId)));

        return installs.map((install) => ({
            ...install.toJSON(),
            services: install.services.map((service) => ({
                ...service,
                address: service.containerId === null ? null : addresses.get(service.containerId) ?? null
            }))
        }) as unknown as TemplateInstallPayload);
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

    async listForProject(tenant: Tenant, projectId: number): Promise<TemplateInstallPayload[]>{
        if(!tenant.isPlatformAdmin){
            const project = await Project.findOneBy({ id: projectId });
            if(!project || !this.#inCallerOrg(project, tenant)) throw TemplateInstallError.Forbidden();
        }
        return this.#presentAll(await TemplateInstall.find({ where: { projectId }, order: { id: 'ASC' } }));
    }

    async get(tenant: Tenant, id: number): Promise<TemplateInstall>{
        const install = await TemplateInstall.findOneBy({ id });
        if(!install) throw TemplateInstallError.NotFound();
        await this.#assertProjectVisible(tenant, install.projectId);
        return install;
    }

    async remove(userId: number | null, tenant: Tenant, id: number): Promise<void>{
        const install = await TemplateInstall.findOneBy({ id });
        if(!install) throw TemplateInstallError.NotFound();
        await this.#assertProjectVisible(tenant, install.projectId);

        const { services, networkId } = install;
        await install.remove();

        eventBus.emit('template.uninstalled', { templateInstallId: id, userId, services, networkId });
    }

    async operate(tenant: Tenant, id: number, operation: TemplateInstallOperation): Promise<TemplateInstallPayload>{
        const install = await this.get(tenant, id);
        const ids = install.services.map((service) => service.containerId).filter((value): value is number => value !== null);
        const containers = ids.length === 0 ? [] : await DockerContainer.findBy({ id: In(ids) });

        for(const container of containers){
            const ops = new ContainerOps(container);
            if(operation === 'stop'){
                await ops.stop();
                container.desiredState = ContainerDesiredState.Stopped;
                await container.save();
            }else if(operation === 'start'){
                container.desiredState = ContainerDesiredState.Running;
                await container.save();
                await ops.start();
            }else{
                await ops.restart();
            }
        }

        install.status = operation === 'stop' ? TemplateInstallStatus.Stopped : TemplateInstallStatus.Running;
        await install.save();
        return this.present(install);
    }

    async containerForUser(userId: number, installId: number, service?: string): Promise<DockerContainer>{
        const install = await this.get(await repositoryTenantOf(userId), installId);
        const target = service !== undefined
            ? install.services.find((entry) => entry.name === service)
            : install.services.find((entry) => entry.kind === 'app') ?? install.services[0];
        if(!target || target.containerId === null) throw TemplateInstallError.NotFound();

        const container = await DockerContainer.findOneBy({ id: target.containerId });
        if(!container || !container.dockerContainerName) throw TemplateInstallError.NotFound();
        return container;
    }

    #startProvisioning(install: TemplateInstall, userId: number){
        eventBus.emit('template.installed', {
            templateInstallId: install.id,
            projectId: install.projectId,
            templateId: install.templateId,
            userId
        });
    }

    async #specOf(install: TemplateInstall): Promise<TemplateSpec>{
        const spec = await installSpec(install);
        if(!spec) throw TemplateInstallError.NotFound();
        return spec;
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
