import { describe, expect, it } from 'vitest';
import { useApp, flushEvents } from '@tests/harness';
import { request, expectError } from '@tests/request';
import { seed } from '@tests/Seed';
import { projectRoutes } from '@quantum/contracts/modules/project/routes';
import { OrganizationRole } from '@quantum/contracts/modules/organization/domain';
import Project from '../models/Project';

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

    it('deletes a project', async () => {
        const { user, project } = await seed.orgContext();

        const res = await request(ctx.app, projectRoutes.remove, {
            as: user.id,
            params: { id: project.id }
        });

        expect(res.status).toBe(204);
        expect(await Project.findOneBy({ id: project.id })).toBeNull();

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
        const { user, org } = await seed.orgContext(OrganizationRole.Viewer);

        const list = await request(ctx.app, projectRoutes.listByOrganization, {
            as: user.id,
            params: { orgId: org.id }
        });
        expect(list.status).toBe(200);

        const write = await request(ctx.app, projectRoutes.create, {
            as: user.id,
            params: { orgId: org.id },
            body: { name: 'Denied' }
        });
        expectError(write, 403, 'Tenancy::InsufficientPermissions');
    });
});
