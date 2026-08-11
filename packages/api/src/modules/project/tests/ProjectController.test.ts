import { describe, expect, it } from 'vitest';
import { useApp, flushEvents } from '@tests/harness';
import { request, expectError } from '@tests/request';
import { seed } from '@tests/Seed';
import { projectRoutes, environmentRoutes } from '@quantum/contracts/modules/project/routes';
import { EnvironmentType } from '@quantum/contracts/modules/project/domain';
import { OrganizationRole } from '@quantum/contracts/modules/organization/domain';
import { UserRole } from '@quantum/contracts/modules/user/domain';
import Project from '../models/Project';
import Environment from '../models/Environment';

const ctx = useApp();

describe('project', () => {
    it('rejects unauthenticated requests', async () => {
        const res = await request(ctx.app, projectRoutes.listByOrganization, { params: { orgId: 1 } });

        expectError(res, 401, 'Authentication::Unauthorized');
    });

    it('creates a project with a generated slug', async () => {
        const { user, org } = await seed.orgContext();

        const res = await request(ctx.app, projectRoutes.create, {
            as: user.id,
            params: { orgId: org.id },
            body: { name: 'My Project' }
        });

        expect(res.status).toBe(201);
        expect(res.data()).toMatchObject({
            name: 'My Project',
            organizationId: org.id,
            isDefault: false
        });
        expect(res.data().slug).toMatch(/^my-project-[0-9a-f]{4}$/);

        await flushEvents();
    });

    it('rejects an invalid create body', async () => {
        const { user, org } = await seed.orgContext();

        const res = await request(ctx.app, projectRoutes.create, {
            as: user.id,
            params: { orgId: org.id },
            body: { name: 'x'.repeat(65) }
        });

        expectError(res, 400, 'Request::ValidationFailed');
    });

    it('forbids create for a viewer', async () => {
        const { user, org } = await seed.orgContext(OrganizationRole.Viewer);

        const res = await request(ctx.app, projectRoutes.create, {
            as: user.id,
            params: { orgId: org.id },
            body: { name: 'Denied' }
        });

        expectError(res, 403, 'Tenancy::InsufficientPermissions');
    });

    it('lists projects scoped to the organization', async () => {
        const { user, org } = await seed.orgContext();
        await request(ctx.app, projectRoutes.create, {
            as: user.id,
            params: { orgId: org.id },
            body: { name: 'Second Project' }
        });

        const other = await seed.orgContext();
        await request(ctx.app, projectRoutes.create, {
            as: other.user.id,
            params: { orgId: other.org.id },
            body: { name: 'Foreign Project' }
        });

        const res = await request(ctx.app, projectRoutes.listByOrganization, {
            as: user.id,
            params: { orgId: org.id }
        });

        expect(res.status).toBe(200);
        expect(res.data()).toHaveLength(2);
        for(const project of res.data()){
            expect(project.organizationId).toBe(org.id);
        }

        await flushEvents();
    });

    it('forbids the project list for a non-member', async () => {
        const { org } = await seed.orgContext();
        const outsider = await seed.user();

        const res = await request(ctx.app, projectRoutes.listByOrganization, {
            as: outsider.id,
            params: { orgId: org.id }
        });

        expectError(res, 403, 'Tenancy::OrganizationForbidden');
    });

    it('gets a project as a member', async () => {
        const { user, project } = await seed.orgContext();

        const res = await request(ctx.app, projectRoutes.get, {
            as: user.id,
            params: { id: project.id }
        });

        expect(res.status).toBe(200);
        expect(res.data()).toMatchObject({ id: project.id, name: project.name });
    });

    it('forbids getting a project of another organization', async () => {
        const owner = await seed.orgContext();
        const outsider = await seed.orgContext();

        const res = await request(ctx.app, projectRoutes.get, {
            as: outsider.user.id,
            params: { id: owner.project.id }
        });

        expectError(res, 403, 'Project::Forbidden');
    });

    it('answers 404 for an unknown project', async () => {
        const { user } = await seed.orgContext();

        const res = await request(ctx.app, projectRoutes.get, {
            as: user.id,
            params: { id: 999999 }
        });

        expectError(res, 404, 'Project::NotFound');
    });

    it('lets a platform admin bypass project ownership', async () => {
        const { project } = await seed.orgContext();
        const admin = await seed.user(UserRole.Admin);

        const res = await request(ctx.app, projectRoutes.get, {
            as: admin.id,
            params: { id: project.id }
        });

        expect(res.status).toBe(200);
        expect(res.data()).toMatchObject({ id: project.id });
    });

    it('updates a project as owner', async () => {
        const { user, project } = await seed.orgContext();

        const res = await request(ctx.app, projectRoutes.update, {
            as: user.id,
            params: { id: project.id },
            body: { name: 'Renamed Project' }
        });

        expect(res.status).toBe(200);
        expect(res.data()).toMatchObject({ id: project.id, name: 'Renamed Project', slug: project.slug });
    });

    it('forbids update for a viewer', async () => {
        const { user, project } = await seed.orgContext(OrganizationRole.Viewer);

        const res = await request(ctx.app, projectRoutes.update, {
            as: user.id,
            params: { id: project.id },
            body: { name: 'Hijacked' }
        });

        expectError(res, 403, 'Tenancy::InsufficientPermissions');
    });

    it('deletes a project and its environments', async () => {
        const { user, project } = await seed.orgContext();
        await request(ctx.app, environmentRoutes.create, {
            as: user.id,
            params: { projectId: project.id },
            body: { name: 'production', type: EnvironmentType.Production }
        });
        await request(ctx.app, environmentRoutes.create, {
            as: user.id,
            params: { projectId: project.id },
            body: { name: 'staging', type: EnvironmentType.Staging }
        });

        const res = await request(ctx.app, projectRoutes.remove, {
            as: user.id,
            params: { id: project.id }
        });

        expect(res.status).toBe(204);
        expect(await Project.findOneBy({ id: project.id })).toBeNull();
        expect(await Environment.countBy({ projectId: project.id })).toBe(0);

        await flushEvents();
    });

    it('forbids delete for a member without project:delete', async () => {
        const { org, project } = await seed.orgContext();
        const member = await seed.member(org);

        const res = await request(ctx.app, projectRoutes.remove, {
            as: member.id,
            params: { id: project.id }
        });

        expectError(res, 403, 'Tenancy::InsufficientPermissions');
    });

    it('lets a viewer read projects but not write them', async () => {
        const { user, org, project } = await seed.orgContext(OrganizationRole.Viewer);

        const list = await request(ctx.app, projectRoutes.listByOrganization, {
            as: user.id,
            params: { orgId: org.id }
        });
        expect(list.status).toBe(200);

        const get = await request(ctx.app, projectRoutes.get, {
            as: user.id,
            params: { id: project.id }
        });
        expect(get.status).toBe(200);

        const write = await request(ctx.app, projectRoutes.create, {
            as: user.id,
            params: { orgId: org.id },
            body: { name: 'Denied' }
        });
        expectError(write, 403, 'Tenancy::InsufficientPermissions');
    });
});

describe('environment', () => {
    it('creates an environment under a project', async () => {
        const { user, org, project } = await seed.orgContext();

        const res = await request(ctx.app, environmentRoutes.create, {
            as: user.id,
            params: { projectId: project.id },
            body: { name: 'production-eu', type: EnvironmentType.Staging }
        });

        expect(res.status).toBe(201);
        expect(res.data()).toMatchObject({
            name: 'production-eu',
            type: EnvironmentType.Staging,
            projectId: project.id,
            organizationId: org.id,
            isDefault: false
        });
    });

    it('rejects a duplicate environment name with 409', async () => {
        const { user, project } = await seed.orgContext();

        await request(ctx.app, environmentRoutes.create, {
            as: user.id,
            params: { projectId: project.id },
            body: { name: 'web', type: EnvironmentType.Production }
        });

        const res = await request(ctx.app, environmentRoutes.create, {
            as: user.id,
            params: { projectId: project.id },
            body: { name: 'web', type: EnvironmentType.Staging }
        });

        expectError(res, 409, 'Environment::NameAlreadyTaken');
    });

    it('rejects an invalid environment body', async () => {
        const { user, project } = await seed.orgContext();

        const res = await request(ctx.app, environmentRoutes.create, {
            as: user.id,
            params: { projectId: project.id },
            body: { name: '', type: EnvironmentType.Production }
        });

        expectError(res, 400, 'Request::ValidationFailed');
    });

    it('forbids environment create for a viewer', async () => {
        const { user, project } = await seed.orgContext(OrganizationRole.Viewer);

        const res = await request(ctx.app, environmentRoutes.create, {
            as: user.id,
            params: { projectId: project.id },
            body: { name: 'web', type: EnvironmentType.Production }
        });

        expectError(res, 403, 'Tenancy::InsufficientPermissions');
    });

    it('lists the environments of a project', async () => {
        const { user, project } = await seed.orgContext();
        for(const name of ['web', 'api']){
            await request(ctx.app, environmentRoutes.create, {
                as: user.id,
                params: { projectId: project.id },
                body: { name, type: EnvironmentType.Production }
            });
        }

        const res = await request(ctx.app, environmentRoutes.list, {
            as: user.id,
            params: { projectId: project.id }
        });

        expect(res.status).toBe(200);
        expect(res.data()).toHaveLength(2);
        for(const environment of res.data()){
            expect(environment.projectId).toBe(project.id);
        }
    });

    it('forbids listing environments of a foreign project', async () => {
        const owner = await seed.orgContext();
        const outsider = await seed.orgContext();

        const res = await request(ctx.app, environmentRoutes.list, {
            as: outsider.user.id,
            params: { projectId: owner.project.id }
        });

        expectError(res, 403, 'Project::Forbidden');
    });

    it('gets an environment', async () => {
        const { user, project } = await seed.orgContext();
        const created = await request(ctx.app, environmentRoutes.create, {
            as: user.id,
            params: { projectId: project.id },
            body: { name: 'web', type: EnvironmentType.Production }
        });

        const res = await request(ctx.app, environmentRoutes.get, {
            as: user.id,
            params: { id: created.data().id }
        });

        expect(res.status).toBe(200);
        expect(res.data()).toMatchObject({ id: created.data().id, name: 'web' });
    });

    it('forbids getting an environment of another organization', async () => {
        const owner = await seed.orgContext();
        const outsider = await seed.orgContext();
        const created = await request(ctx.app, environmentRoutes.create, {
            as: owner.user.id,
            params: { projectId: owner.project.id },
            body: { name: 'web', type: EnvironmentType.Production }
        });

        const res = await request(ctx.app, environmentRoutes.get, {
            as: outsider.user.id,
            params: { id: created.data().id }
        });

        expectError(res, 403, 'Project::Forbidden');
    });

    it('answers 404 for an unknown environment', async () => {
        const { user } = await seed.orgContext();

        const res = await request(ctx.app, environmentRoutes.get, {
            as: user.id,
            params: { id: 999999 }
        });

        expectError(res, 404, 'Environment::NotFound');
    });

    it('updates an environment', async () => {
        const { user, project } = await seed.orgContext();
        const created = await request(ctx.app, environmentRoutes.create, {
            as: user.id,
            params: { projectId: project.id },
            body: { name: 'web', type: EnvironmentType.Production }
        });

        const res = await request(ctx.app, environmentRoutes.update, {
            as: user.id,
            params: { id: created.data().id },
            body: { name: 'web-eu', type: EnvironmentType.Preview }
        });

        expect(res.status).toBe(200);
        expect(res.data()).toMatchObject({
            id: created.data().id,
            name: 'web-eu',
            type: EnvironmentType.Preview
        });
    });

    it('rejects renaming an environment to a taken name', async () => {
        const { user, project } = await seed.orgContext();
        await request(ctx.app, environmentRoutes.create, {
            as: user.id,
            params: { projectId: project.id },
            body: { name: 'web', type: EnvironmentType.Production }
        });
        const api = await request(ctx.app, environmentRoutes.create, {
            as: user.id,
            params: { projectId: project.id },
            body: { name: 'api', type: EnvironmentType.Production }
        });

        const res = await request(ctx.app, environmentRoutes.update, {
            as: user.id,
            params: { id: api.data().id },
            body: { name: 'web' }
        });

        expectError(res, 409, 'Environment::NameAlreadyTaken');
    });

    it('deletes an environment', async () => {
        const { user, project } = await seed.orgContext();
        const created = await request(ctx.app, environmentRoutes.create, {
            as: user.id,
            params: { projectId: project.id },
            body: { name: 'web', type: EnvironmentType.Production }
        });

        const res = await request(ctx.app, environmentRoutes.remove, {
            as: user.id,
            params: { id: created.data().id }
        });

        expect(res.status).toBe(204);
        expect(await Environment.findOneBy({ id: created.data().id })).toBeNull();
    });

    it('lets a viewer read environments but not write them', async () => {
        const { user, project } = await seed.orgContext(OrganizationRole.Viewer);

        const list = await request(ctx.app, environmentRoutes.list, {
            as: user.id,
            params: { projectId: project.id }
        });
        expect(list.status).toBe(200);

        const write = await request(ctx.app, environmentRoutes.create, {
            as: user.id,
            params: { projectId: project.id },
            body: { name: 'web', type: EnvironmentType.Production }
        });
        expectError(write, 403, 'Tenancy::InsufficientPermissions');
    });
});
