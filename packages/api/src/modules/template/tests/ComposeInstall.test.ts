import { describe, expect, it } from 'vitest';
import { useApp, flushEvents } from '@tests/harness';
import { request, expectError } from '@tests/request';
import { seed } from '@tests/Seed';
import { eventBus } from '@/shared/events/EventBus';
import { OrganizationRole } from '@quantum/contracts/modules/organization/domain';
import { TemplateInstallStatus, TemplateSource } from '@quantum/contracts/modules/template/domain';
import { templateInstallRoutes, templateRoutes } from '@quantum/contracts/modules/template/routes';
import Template from '../models/Template';
import TemplateInstall from '../models/TemplateInstall';
import type { TemplateInstalledPayload } from '../contracts/domain/events';

const ctx = useApp();

const COMPOSE = `services:
  web:
    image: nginx:1.27
    environment:
      API_URL: http://api:9000
    ports:
      - "8080:80"
    depends_on:
      - api
  api:
    image: ghcr.io/acme/api:latest
    environment:
      PORT: "9000"
`;

const collect = <T>(event: keyof EventMap): T[] => {
    const received: T[] = [];
    eventBus.subscribe(event, (payload) => {
        received.push(payload as T);
    });
    return received;
};

const createCompose = (userId: number, projectId: number, compose = COMPOSE, name = 'shop') =>
    request(ctx.app, templateInstallRoutes.createCompose, { as: userId, params: { projectId }, body: { name, compose } });

describe('compose installs', () => {
    it('creates an install that owns its spec and starts provisioning it', async () => {
        const { user, org, project } = await seed.orgContext();
        const installed = collect<TemplateInstalledPayload>('template.installed');

        const res = await createCompose(user.id, project.id);

        expect(res.status).toBe(201);
        expect(res.data()).toMatchObject({
            name: 'shop',
            templateId: null,
            compose: COMPOSE,
            projectId: project.id,
            organizationId: org.id,
            status: TemplateInstallStatus.Pending,
            services: [],
            environment: {}
        });
        expect(res.json()).not.toHaveProperty('data.spec.services.web.build');

        const row = await TemplateInstall.findOneBy({ id: res.data().id });
        expect(row?.spec?.services.web).toMatchObject({ image: 'nginx:1.27', depends_on: ['api'] });

        await flushEvents();
        expect(installed).toEqual([{ templateInstallId: res.data().id, projectId: project.id, templateId: null, userId: user.id }]);
    });

    it('rejects a compose file it cannot deploy, naming the reason', async () => {
        const { user, project } = await seed.orgContext();

        const invalid = await createCompose(user.id, project.id, 'services: {}');
        expectError(invalid, 400, 'TemplateInstall::InvalidCompose:services');

        const unsupported = await createCompose(user.id, project.id, 'services:\n  web:\n    build: .\n');
        expectError(unsupported, 400, 'TemplateInstall::UnsupportedCompose:build:web');
    });

    it('forbids the viewer role and foreign projects', async () => {
        const viewer = await seed.orgContext(OrganizationRole.Viewer);
        expectError(await createCompose(viewer.user.id, viewer.project.id), 403, 'Tenancy::InsufficientPermissions');

        const { project } = await seed.orgContext();
        const outsider = await seed.user();
        expectError(await createCompose(outsider.id, project.id), 403, 'TemplateInstall::Forbidden');
    });

    it('lets the owner edit the compose file, and refuses it on a template install', async () => {
        const { user, org, project } = await seed.orgContext();
        const created = await createCompose(user.id, project.id);

        const edited = COMPOSE.replace('nginx:1.27', 'nginx:1.28');
        const res = await request(ctx.app, templateInstallRoutes.updateCompose, {
            as: user.id,
            params: { id: created.data().id },
            body: { compose: edited }
        });
        expect(res.status).toBe(200);
        expect(res.data().compose).toBe(edited);

        const row = await TemplateInstall.findOneBy({ id: created.data().id });
        expect(row?.spec?.services.web.image).toBe('nginx:1.28');

        const template = await Template.create({
            name: 'Redis', slug: 'redis', description: null, icon: null, website: null,
            source: TemplateSource.Builtin, organizationId: null,
            spec: { services: { app: { image: 'redis:7', environment: { MAXMEMORY: '{{ MAXMEMORY }}' } } } },
            inputsSchema: [{ key: 'MAXMEMORY', label: 'Max memory', type: 'string', default: '256mb' }]
        }).save();
        const fromTemplate = await request(ctx.app, templateRoutes.install, {
            as: user.id, params: { projectId: project.id }, body: { templateId: template.id, name: 'cache' }
        });
        expect(fromTemplate.data().organizationId).toBe(org.id);

        const refused = await request(ctx.app, templateInstallRoutes.updateCompose, {
            as: user.id, params: { id: fromTemplate.data().id }, body: { compose: COMPOSE }
        });
        expectError(refused, 400, 'TemplateInstall::NotCompose');
    });

    it('reads the effective environment per service and stores overrides that win over the file', async () => {
        const { user, project } = await seed.orgContext();
        const created = await createCompose(user.id, project.id);
        const id = created.data().id;

        const before = await request(ctx.app, templateInstallRoutes.environment, { as: user.id, params: { id } });
        expect(before.status).toBe(200);
        expect(before.data()).toEqual({
            installId: id,
            services: [
                { name: 'web', environmentVariables: { API_URL: 'http://api:9000' } },
                { name: 'api', environmentVariables: { PORT: '9000' } }
            ]
        });

        const saved = await request(ctx.app, templateInstallRoutes.updateEnvironment, {
            as: user.id, params: { id }, body: { environment: { api: { PORT: '9100', DEBUG: '1' } } }
        });
        expect(saved.status).toBe(200);
        expect(saved.data().environment).toEqual({ api: { PORT: '9100', DEBUG: '1' } });

        const after = await request(ctx.app, templateInstallRoutes.environment, { as: user.id, params: { id } });
        expect(after.data().services).toEqual([
            { name: 'web', environmentVariables: { API_URL: 'http://api:9000' } },
            { name: 'api', environmentVariables: { PORT: '9100', DEBUG: '1' } }
        ]);

        const unknown = await request(ctx.app, templateInstallRoutes.updateEnvironment, {
            as: user.id, params: { id }, body: { environment: { ghost: { A: '1' } } }
        });
        expectError(unknown, 400, 'TemplateInstall::UnknownService:ghost');
    });

    it('resolves template inputs into the environment a template install reports', async () => {
        const { user, project } = await seed.orgContext();
        const template = await Template.create({
            name: 'Redis', slug: 'redis', description: null, icon: null, website: null,
            source: TemplateSource.Builtin, organizationId: null,
            spec: { services: { app: { image: 'redis:7', environment: { MAXMEMORY: '{{ MAXMEMORY }}' } } } },
            inputsSchema: [{ key: 'MAXMEMORY', label: 'Max memory', type: 'string', default: '256mb' }]
        }).save();
        const installed = await request(ctx.app, templateRoutes.install, {
            as: user.id, params: { projectId: project.id }, body: { templateId: template.id, name: 'cache', inputs: { MAXMEMORY: '1gb' } }
        });

        const res = await request(ctx.app, templateInstallRoutes.environment, { as: user.id, params: { id: installed.data().id } });

        expect(res.data().services).toEqual([{ name: 'app', environmentVariables: { MAXMEMORY: '1gb' } }]);
    });

    it('queues a fresh provisioning run on redeploy', async () => {
        const { user, project } = await seed.orgContext();
        const created = await createCompose(user.id, project.id);
        await flushEvents();
        const installed = collect<TemplateInstalledPayload>('template.installed');

        const res = await request(ctx.app, templateInstallRoutes.redeploy, { as: user.id, params: { id: created.data().id } });

        expect(res.status).toBe(200);
        expect(res.data().status).toBe(TemplateInstallStatus.Pending);
        await flushEvents();
        expect(installed).toHaveLength(1);
    });
});
