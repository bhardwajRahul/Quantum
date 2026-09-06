import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto';
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
import ActivityService from '@/modules/activity/services/ActivityService';
import { ActivityLevel } from '@quantum/contracts/modules/activity/domain';
import { config } from '@/shared/config';
import { eventBus } from '@/shared/events/EventBus';
import TemplateInstall from '../models/TemplateInstall';
import TemplateService from './TemplateService';
import { composeToSpec, composeVariables, interpolateCompose } from './composeSpec';
import GithubRepositoryService from '@/modules/github/services/GithubRepositoryService';
import GithubWebhookService from '@/modules/github/services/GithubWebhookService';
import { installInputs, installSpec, serviceEnvironment } from './installEnvironment';
import { TemplateInstallError } from '../contracts/domain/errors';
import type { Tenant } from '@/modules/organization/contracts/types/fastify';
import type {
    CreateComposeInstallInput,
    InstallTemplateInput,
    TemplateInstallOperation,
    CreateSourceInstallInput,
    InspectStackSourceInput,
    UpdateComposeInput,
    UpdateStackSourceInput,
    UpdateStackVariablesInput,
    UpdateTemplateInstallEnvironmentInput
} from '@quantum/contracts/modules/template/http';
import type { WebhookOutcome } from '@quantum/contracts/modules/repository/domain';
import type {
    StackSource,
    StackSourceInspection,
    TemplateInstall as TemplateInstallPayload,
    TemplateInstallEnvironment,
    TemplateSpec
} from '@quantum/contracts/modules/template/domain';

const COMPOSE_FILE = /^(docker-)?compose(\.[\w-]+)?\.ya?ml$/;
const PREFERRED_COMPOSE = ['compose.yaml', 'compose.yml', 'docker-compose.yml', 'docker-compose.yaml'];

const byComposePreference = (a: string, b: string): number => {
    const rank = (file: string): number => {
        const index = PREFERRED_COMPOSE.indexOf(file);
        return index === -1 ? PREFERRED_COMPOSE.length : index;
    };
    return rank(a) - rank(b) || a.localeCompare(b);
};

interface GithubEvent{
    ref?: string;
    action?: string;
    pusher?: { name?: string };
    head_commit?: { message?: string } | null;
    release?: { tag_name?: string; name?: string | null };
}

const validSignature = (secret: string, signature: string | undefined, rawBody: Buffer | undefined): boolean => {
    if(signature === undefined || rawBody === undefined) return false;
    const expected = Buffer.from('sha256=' + createHmac('sha256', secret).update(rawBody).digest('hex'));
    const received = Buffer.from(signature);
    return received.length === expected.length && timingSafeEqual(received, expected);
};

export default class TemplateInstallService{
    #templates = new TemplateService();
    #cipher = new SecretCipher();
    #github = new GithubRepositoryService();
    #webhooks = new GithubWebhookService();

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
        const spec = composeToSpec(interpolateCompose(input.compose, {}, { strict: false }));

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

        install.spec = composeToSpec(interpolateCompose(input.compose, installInputs(install), { strict: false }));
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

        const { services, networkId, source, webhookId } = install;
        if(source !== null && webhookId !== null && install.userId !== null){
            await this.#webhooks.remove(install.userId, source.owner, source.repo, webhookId).catch(() => undefined);
        }
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

    async inspectSource(userId: number, input: InspectStackSourceInput): Promise<StackSourceInspection>{
        const files = await this.#github.listRootFiles(userId, input.owner, input.repo, input.branch);
        const composeFiles = files.filter((file) => COMPOSE_FILE.test(file)).sort(byComposePreference);
        const composePath = input.composePath ?? composeFiles[0] ?? null;
        if(composePath === null) return { composeFiles, composePath, variables: [], problem: null };

        const text = await this.#github.readFile(userId, input.owner, input.repo, input.branch, composePath);
        if(text === null) throw TemplateInstallError.ComposeFileNotFound(composePath);
        return { composeFiles, composePath, variables: composeVariables(text), problem: this.#problemOf(text) };
    }

    async createFromSource(userId: number, tenant: Tenant, projectId: number, input: CreateSourceInstallInput): Promise<TemplateInstallPayload>{
        const project = await this.#projectFor(tenant, projectId);
        const source: StackSource = {
            owner: input.owner, repo: input.repo, branch: input.branch, composePath: input.composePath, deployOn: input.deployOn
        };
        const text = await this.#github.readFile(userId, source.owner, source.repo, source.branch, source.composePath);
        if(text === null) throw TemplateInstallError.ComposeFileNotFound(source.composePath);
        const variables = input.variables ?? {};
        const spec = composeToSpec(interpolateCompose(text, variables), { allowBuild: true });

        const install = await TemplateInstall.create({
            templateId: null,
            compose: text,
            spec,
            name: input.name,
            organizationId: project.organizationId,
            projectId: project.id,
            userId,
            nodeId: process.env.NODE_ID ?? 'local',
            inputsEnc: Object.keys(variables).length === 0 ? null : this.#cipher.encrypt(JSON.stringify(variables)),
            source
        }).save();

        await this.#registerWebhook(install, userId);
        this.#startProvisioning(install, userId);
        return this.present(install);
    }

    async updateSource(tenant: Tenant, id: number, input: UpdateStackSourceInput): Promise<TemplateInstallPayload>{
        const install = await this.get(tenant, id);
        if(install.source === null) throw TemplateInstallError.NotSourced();
        install.source = { ...install.source, branch: input.branch, composePath: input.composePath, deployOn: input.deployOn };
        await install.save();
        return this.present(install);
    }

    async variables(tenant: Tenant, id: number): Promise<Record<string, string>>{
        const install = await this.get(tenant, id);
        if(install.compose === null) throw TemplateInstallError.NotCompose();
        return installInputs(install);
    }

    async updateVariables(tenant: Tenant, id: number, input: UpdateStackVariablesInput): Promise<TemplateInstallPayload>{
        const install = await this.get(tenant, id);
        if(install.compose === null) throw TemplateInstallError.NotCompose();
        install.inputsEnc = Object.keys(input.variables).length === 0 ? null : this.#cipher.encrypt(JSON.stringify(input.variables));
        await install.save();
        return this.present(install);
    }

    async githubHook(
        id: number,
        event: string | undefined,
        signature: string | undefined,
        rawBody: Buffer | undefined,
        payload: unknown
    ): Promise<{ status: 200 | 202; outcome: WebhookOutcome }>{
        const install = await TemplateInstall.findOneBy({ id });
        if(!install || install.source === null || install.webhookSecretEnc === null) throw TemplateInstallError.NotFound();
        if(!validSignature(this.#cipher.decrypt(install.webhookSecretEnc), signature, rawBody)) throw TemplateInstallError.InvalidSignature();

        const source = install.source;
        const body = (payload ?? {}) as GithubEvent;

        if(event === 'push' && source.deployOn === 'push'){
            if((body.ref ?? '') !== `refs/heads/${source.branch}`) return { status: 200, outcome: { skipped: true, reason: 'branch-mismatch' } };
            const pusher = body.pusher?.name;
            await this.requestRedeploy(
                install,
                'github',
                `${install.name}: push to ${source.branch}${pusher ? ` by ${pusher}` : ''}`,
                body.head_commit?.message?.split('\n')[0] ?? ''
            );
            return { status: 202, outcome: { skipped: false } };
        }

        if(event === 'release' && source.deployOn === 'release'){
            if(body.action !== 'published') return { status: 200, outcome: { skipped: true, reason: 'not-published' } };
            await this.requestRedeploy(install, 'github', `${install.name}: release ${body.release?.tag_name ?? ''}`.trim(), body.release?.name ?? '');
            return { status: 202, outcome: { skipped: false } };
        }

        return { status: 200, outcome: { ok: true } };
    }

    async #registerWebhook(install: TemplateInstall, userId: number): Promise<void>{
        const source = install.source;
        if(source === null) return;

        const secret = randomBytes(32).toString('hex');
        const url = `${config.domain.replace(/\/$/, '')}/template/install/${install.id}/github`;
        try{
            install.webhookId = await this.#webhooks.register(userId, source.owner, source.repo, url, secret);
            install.webhookSecretEnc = this.#cipher.encrypt(secret);
            await install.save();
        }catch(error){
            await new ActivityService().create({
                organizationId: install.organizationId,
                userId,
                scope: 'template',
                level: ActivityLevel.Warn,
                title: `${install.name}: could not register the GitHub webhook`,
                message: `${(error as Error).message}. Pushes to ${source.owner}/${source.repo} will not redeploy this stack.`,
                source: 'template.source',
                correlationId: null,
                meta: { templateInstallId: install.id }
            });
        }
    }

    #problemOf(text: string): string | null{
        try{
            composeToSpec(interpolateCompose(text, {}, { strict: false }), { allowBuild: true });
            return null;
        }catch(error){
            return error instanceof Error ? error.message : String(error);
        }
    }

    async requestRedeploy(install: TemplateInstall, source: string, title: string, message = ''): Promise<void>{
        await new ActivityService().create({
            organizationId: install.organizationId,
            userId: null,
            scope: 'template',
            level: ActivityLevel.Info,
            title,
            message,
            source,
            correlationId: null,
            meta: { templateInstallId: install.id }
        });
        install.status = TemplateInstallStatus.Pending;
        await install.save();
        this.#startProvisioning(install, install.userId ?? 0);
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
