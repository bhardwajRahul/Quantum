import { describe, expect, it } from 'vitest';
import { useApp, flushEvents } from '@tests/harness';
import { request, expectError } from '@tests/request';
import { seed } from '@tests/Seed';
import { eventBus } from '@/shared/events/EventBus';
import { OrganizationRole } from '@quantum/contracts/modules/organization/domain';
import { TemplateSource } from '@quantum/contracts/modules/template/domain';
import { templateInstallRoutes, templateRoutes } from '@quantum/contracts/modules/template/routes';
import Template from '../models/Template';
import TemplateInstall from '../models/TemplateInstall';
import type { TemplateSpec } from '@quantum/contracts/modules/template/domain';
import type { CreateTemplateInput } from '@quantum/contracts/modules/template/http';
import type { TemplateDeletedPayload, TemplateInstalledPayload } from '../contracts/domain/events';
import type { TemplateFields } from '../contracts/domain/template';

const ctx = useApp();

const spec = (image: string): TemplateSpec => ({ services: { app: { image } } });

const seedBuiltin = (overrides: Partial<Omit<TemplateFields, 'createdAt' | 'updatedAt'>> = {}) => Template.create({
    name: 'Postgres',
    slug: 'postgres',
    version: '1.0.0',
    category: 'database',
    description: null,
    icon: null,
    website: null,
    source: TemplateSource.Builtin,
    organizationId: null,
    spec: spec('postgres:16'),
    ...overrides
}).save();

const createTemplate = (userId: number, orgId: number, overrides: Partial<CreateTemplateInput> = {}) =>
    request(ctx.app, templateRoutes.create, {
        as: userId,
        params: { orgId },
        body: { name: 'Redis Cache', spec: spec('redis:7'), ...overrides }
    });

const installTemplate = (userId: number, projectId: number, templateId: number, name = 'My Redis') =>
    request(ctx.app, templateRoutes.install, {
        as: userId,
        params: { projectId },
        body: { templateId, name }
    });

const collect = <T>(event: keyof EventMap): T[] => {
    const received: T[] = [];
    eventBus.subscribe(event, (payload) => {
        received.push(payload as T);
    });
    return received;
};

describe('template', () => {
    it('rejects unauthenticated requests', async () => {
        const res = await request(ctx.app, templateRoutes.list);

        expectError(res, 401, 'Authentication::Unauthorized');
    });

    it('creates a custom template scoped to the organization', async () => {
        const { user, org } = await seed.orgContext();

        const res = await createTemplate(user.id, org.id);

        expect(res.status).toBe(201);
        expect(res.data()).toMatchObject({
            name: 'Redis Cache',
            slug: 'redis-cache',
            version: '1.0.0',
            category: 'other',
            source: TemplateSource.Custom,
            organizationId: org.id,
            spec: spec('redis:7')
        });
    });

    it('rejects an invalid create body', async () => {
        const { user, org } = await seed.orgContext();

        const res = await request(ctx.app, templateRoutes.create, {
            as: user.id,
            params: { orgId: org.id },
            body: { name: '', spec: { services: { app: { image: 'redis:7' } } } }
        });

        expectError(res, 400, 'Request::ValidationFailed');
    });

    it('rejects a duplicate slug and version with 409', async () => {
        const { user, org } = await seed.orgContext();
        await createTemplate(user.id, org.id, { slug: 'cache' });

        const res = await createTemplate(user.id, org.id, { slug: 'cache', name: 'Cache Two' });

        expectError(res, 409, 'Template::SlugAlreadyTaken');
    });

    it('forbids template creation for the viewer role', async () => {
        const { user, org } = await seed.orgContext(OrganizationRole.Viewer);

        const res = await createTemplate(user.id, org.id);

        expectError(res, 403, 'Tenancy::InsufficientPermissions');
    });

    it('lists builtin templates for everyone and custom templates only for member organizations', async () => {
        await seedBuiltin();
        await seedBuiltin({ name: 'Nginx', slug: 'nginx', category: 'networking', spec: spec('nginx:1') });
        const { user, org } = await seed.orgContext();
        await createTemplate(user.id, org.id);
        const outsider = await seed.user();

        const mine = await request(ctx.app, templateRoutes.list, { as: user.id });
        expect(mine.status).toBe(200);
        expect(mine.data().map((template) => template.name).sort()).toEqual(['Nginx', 'Postgres', 'Redis Cache']);

        const theirs = await request(ctx.app, templateRoutes.list, { as: outsider.id });
        expect(theirs.status).toBe(200);
        expect(theirs.data()).toHaveLength(2);
        expect(theirs.data().every((template) => template.source === TemplateSource.Builtin)).toBe(true);
    });

    it('filters the list by category', async () => {
        await seedBuiltin();
        const { user, org } = await seed.orgContext();
        await createTemplate(user.id, org.id, { category: 'cms' });

        const res = await request(ctx.app, templateRoutes.list, { as: user.id, query: { category: 'cms' } });

        expect(res.status).toBe(200);
        expect(res.data()).toHaveLength(1);
        expect(res.data()[0].category).toBe('cms');
    });

    it('lists distinct visible categories sorted', async () => {
        await seedBuiltin();
        const { user, org } = await seed.orgContext();
        await createTemplate(user.id, org.id, { category: 'cms' });

        const res = await request(ctx.app, templateRoutes.categories, { as: user.id });

        expect(res.status).toBe(200);
        expect(res.data()).toEqual(['cms', 'database']);
    });

    it('gets a visible template', async () => {
        const builtin = await seedBuiltin();
        const outsider = await seed.user();

        const res = await request(ctx.app, templateRoutes.get, { as: outsider.id, params: { id: builtin.id } });

        expect(res.status).toBe(200);
        expect(res.data()).toMatchObject({ id: builtin.id, slug: 'postgres' });
    });

    it('answers 404 for a template outside the caller organizations', async () => {
        const { user, org } = await seed.orgContext();
        const created = await createTemplate(user.id, org.id);
        const outsider = await seed.user();

        const res = await request(ctx.app, templateRoutes.get, { as: outsider.id, params: { id: created.data().id } });

        expectError(res, 404, 'Template::NotFound');
    });

    it('answers 404 for a missing template', async () => {
        const { user } = await seed.orgContext();

        const res = await request(ctx.app, templateRoutes.get, { as: user.id, params: { id: 999999 } });

        expectError(res, 404, 'Template::NotFound');
    });

    it('deletes a custom template and emits template.deleted', async () => {
        const { user, org } = await seed.orgContext();
        const created = await createTemplate(user.id, org.id);
        const deleted = collect<TemplateDeletedPayload>('template.deleted');

        const res = await request(ctx.app, templateRoutes.remove, { as: user.id, params: { id: created.data().id } });

        expect(res.status).toBe(204);
        expect(await Template.findOneBy({ id: created.data().id })).toBeNull();
        await flushEvents();
        expect(deleted).toEqual([{ templateId: created.data().id }]);
    });

    it('refuses to delete builtin templates', async () => {
        const builtin = await seedBuiltin();
        const { user } = await seed.orgContext();

        const res = await request(ctx.app, templateRoutes.remove, { as: user.id, params: { id: builtin.id } });

        expectError(res, 404, 'Template::NotFound');
    });

    it('forbids template deletion for the viewer role', async () => {
        const { user, org } = await seed.orgContext();
        const viewer = await seed.member(org, OrganizationRole.Viewer);
        const created = await createTemplate(user.id, org.id);

        const res = await request(ctx.app, templateRoutes.remove, { as: viewer.id, params: { id: created.data().id } });

        expectError(res, 403, 'Tenancy::InsufficientPermissions');
    });
});

describe('template install', () => {
    it('installs a template into a project and emits template.installed', async () => {
        const { user, org, project } = await seed.orgContext();
        const created = await createTemplate(user.id, org.id);
        const installed = collect<TemplateInstalledPayload>('template.installed');

        const res = await installTemplate(user.id, project.id, created.data().id);

        expect(res.status).toBe(201);
        expect(res.data()).toMatchObject({
            templateId: created.data().id,
            templateVersion: '1.0.0',
            name: 'My Redis',
            projectId: project.id,
            organizationId: org.id,
            userId: user.id,
            environmentId: null,
            nodeId: 'local'
        });

        await flushEvents();
        expect(installed).toEqual([{
            templateInstallId: res.data().id,
            projectId: project.id,
            templateId: created.data().id,
            userId: user.id
        }]);
    });

    it('answers 404 when installing into a missing project', async () => {
        const { user } = await seed.orgContext();
        const builtin = await seedBuiltin();

        const res = await installTemplate(user.id, 999999, builtin.id, 'Ghost');

        expectError(res, 404, 'TemplateInstall::NotFound');
    });

    it('refuses to install a template the caller cannot see', async () => {
        const owner = await seed.user();
        const foreignOrg = await seed.org(owner);
        const created = await createTemplate(owner.id, foreignOrg.id);

        const { user, project } = await seed.orgContext();

        const res = await installTemplate(user.id, project.id, created.data().id, 'Steal');

        expectError(res, 404, 'Template::NotFound');
    });

    it('forbids install for the viewer role', async () => {
        const { user, project } = await seed.orgContext(OrganizationRole.Viewer);
        const builtin = await seedBuiltin();

        const res = await installTemplate(user.id, project.id, builtin.id, 'Denied');

        expectError(res, 403, 'Tenancy::InsufficientPermissions');
    });

    it('forbids installing into a project outside the caller organizations', async () => {
        const { org } = await seed.orgContext();
        const outsider = await seed.user();
        const project = await seed.project(org);
        const builtin = await seedBuiltin();

        const res = await installTemplate(outsider.id, project.id, builtin.id, 'Intruder');

        expectError(res, 403, 'TemplateInstall::Forbidden');
    });

    it('lists the installs of a project', async () => {
        const { user, org, project } = await seed.orgContext();
        const created = await createTemplate(user.id, org.id);
        await installTemplate(user.id, project.id, created.data().id);

        const res = await request(ctx.app, templateInstallRoutes.listByProject, {
            as: user.id,
            params: { projectId: project.id }
        });

        expect(res.status).toBe(200);
        expect(res.data()).toHaveLength(1);
        expect(res.data()[0]).toMatchObject({ name: 'My Redis', projectId: project.id });
    });

    it('forbids the install list for a non-member', async () => {
        const { project } = await seed.orgContext();
        const outsider = await seed.user();

        const res = await request(ctx.app, templateInstallRoutes.listByProject, {
            as: outsider.id,
            params: { projectId: project.id }
        });

        expectError(res, 403, 'TemplateInstall::Forbidden');
    });

    it('gets an install for a member', async () => {
        const { user, org, project } = await seed.orgContext();
        const created = await createTemplate(user.id, org.id);
        const installed = await installTemplate(user.id, project.id, created.data().id);

        const res = await request(ctx.app, templateInstallRoutes.get, {
            as: user.id,
            params: { id: installed.data().id }
        });

        expect(res.status).toBe(200);
        expect(res.data()).toMatchObject({ id: installed.data().id, name: 'My Redis' });
    });

    it('answers 404 when getting an install from another organization', async () => {
        const { user, org, project } = await seed.orgContext();
        const created = await createTemplate(user.id, org.id);
        const installed = await installTemplate(user.id, project.id, created.data().id);
        const outsider = await seed.user();

        const res = await request(ctx.app, templateInstallRoutes.get, {
            as: outsider.id,
            params: { id: installed.data().id }
        });

        expectError(res, 404, 'TemplateInstall::NotFound');
    });

    it('deletes an install', async () => {
        const { user, org, project } = await seed.orgContext();
        const created = await createTemplate(user.id, org.id);
        const installed = await installTemplate(user.id, project.id, created.data().id);

        const res = await request(ctx.app, templateInstallRoutes.remove, {
            as: user.id,
            params: { id: installed.data().id }
        });

        expect(res.status).toBe(204);
        expect(await TemplateInstall.findOneBy({ id: installed.data().id })).toBeNull();
    });

    it('forbids install deletion for the viewer role', async () => {
        const { user, org, project } = await seed.orgContext();
        const viewer = await seed.member(org, OrganizationRole.Viewer);
        const created = await createTemplate(user.id, org.id);
        const installed = await installTemplate(user.id, project.id, created.data().id);

        const res = await request(ctx.app, templateInstallRoutes.remove, {
            as: viewer.id,
            params: { id: installed.data().id }
        });

        expectError(res, 403, 'Tenancy::InsufficientPermissions');
    });
});
