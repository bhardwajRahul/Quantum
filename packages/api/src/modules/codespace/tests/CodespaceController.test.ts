import { describe, expect, it } from 'vitest';
import { useApp, flushEvents } from '@tests/harness';
import { request, expectError } from '@tests/request';
import { seed } from '@tests/Seed';
import { eventBus } from '@/shared/events/EventBus';
import SecretCipher from '@/shared/services/SecretCipher';
import { codespaceRoutes, portBindingRoutes } from '@quantum/contracts/modules/codespace/routes';
import { CodespaceStatus, PortBindingProtocol } from '@quantum/contracts/modules/codespace/domain';
import { OrganizationRole } from '@quantum/contracts/modules/organization/domain';
import { UserRole } from '@quantum/contracts/modules/user/domain';
import Codespace from '../models/Codespace';
import PortBinding from '../models/PortBinding';
import type { CodespaceProvisionRequestedPayload, PortBindingChangedPayload } from '../contracts/domain/events';

const ctx = useApp();

const collect = <T>(event: keyof EventMap): T[] => {
    const received: T[] = [];
    eventBus.subscribe(event, (payload) => {
        received.push(payload as T);
    });
    return received;
};

const createCodespace = (userId: number, projectId: number, name = 'Dev Box') =>
    request(ctx.app, codespaceRoutes.create, {
        as: userId,
        params: { projectId },
        body: { name }
    });

describe('codespace', () => {
    it('rejects unauthenticated requests', async () => {
        const res = await request(ctx.app, codespaceRoutes.listByProject, { params: { projectId: 1 } });

        expectError(res, 401, 'Authentication::Unauthorized');
    });

    it('creates a pending codespace with defaults and requests provisioning', async () => {
        const { user, org, project } = await seed.orgContext();
        const events = collect<CodespaceProvisionRequestedPayload>('codespace.provisionRequested');

        const res = await createCodespace(user.id, project.id);

        expect(res.status).toBe(201);
        expect(res.data()).toMatchObject({
            name: 'Dev Box',
            organizationId: org.id,
            projectId: project.id,
            userId: user.id,
            status: CodespaceStatus.Pending,
            cpuCores: 1,
            memoryMb: 2048,
            diskGb: 10,
            nodeId: 'local'
        });
        expect(res.json<{ data: Record<string, unknown> }>().data.passwordEnc).toBeUndefined();

        await flushEvents();
        expect(events).toEqual([{ codespaceId: res.data().id, action: 'create', userId: user.id }]);
    });

    it('creates a codespace with custom resources', async () => {
        const { user, project } = await seed.orgContext();

        const res = await request(ctx.app, codespaceRoutes.create, {
            as: user.id,
            params: { projectId: project.id },
            body: { name: 'Big Box', cpuCores: 4, memoryMb: 8192, diskGb: 50 }
        });

        expect(res.status).toBe(201);
        expect(res.data()).toMatchObject({ cpuCores: 4, memoryMb: 8192, diskGb: 50 });

        await flushEvents();
    });

    it('rejects an invalid create body', async () => {
        const { user, project } = await seed.orgContext();

        const missing = await request(ctx.app, codespaceRoutes.create, {
            as: user.id,
            params: { projectId: project.id },
            body: { name: '' }
        });
        expectError(missing, 400, 'Request::ValidationFailed');

        const blank = await request(ctx.app, codespaceRoutes.create, {
            as: user.id,
            params: { projectId: project.id },
            body: { name: '   ' }
        });
        expectError(blank, 400, 'Request::ValidationFailed');

        const oversized = await request(ctx.app, codespaceRoutes.create, {
            as: user.id,
            params: { projectId: project.id },
            body: { name: 'Too Big', cpuCores: 9 }
        });
        expectError(oversized, 400, 'Request::ValidationFailed');
    });

    it('forbids create for a viewer but allows a member', async () => {
        const viewer = await seed.orgContext(OrganizationRole.Viewer);
        const denied = await createCodespace(viewer.user.id, viewer.project.id);
        expectError(denied, 403, 'Tenancy::InsufficientPermissions');

        const member = await seed.orgContext(OrganizationRole.Member);
        const allowed = await createCodespace(member.user.id, member.project.id);
        expect(allowed.status).toBe(201);

        await flushEvents();
    });

    it('lists codespaces scoped to the project', async () => {
        const { user, org, project } = await seed.orgContext();
        await createCodespace(user.id, project.id, 'first');
        await createCodespace(user.id, project.id, 'second');
        const otherProject = await seed.project(org);
        await createCodespace(user.id, otherProject.id, 'elsewhere');

        const res = await request(ctx.app, codespaceRoutes.listByProject, {
            as: user.id,
            params: { projectId: project.id }
        });

        expect(res.status).toBe(200);
        expect(res.data()).toHaveLength(2);
        for(const codespace of res.data()){
            expect(codespace.projectId).toBe(project.id);
        }

        await flushEvents();
    });

    it('forbids listing codespaces of a foreign project', async () => {
        const owner = await seed.orgContext();
        const outsider = await seed.orgContext();

        const res = await request(ctx.app, codespaceRoutes.listByProject, {
            as: outsider.user.id,
            params: { projectId: owner.project.id }
        });

        expectError(res, 403, 'Codespace::Forbidden');
    });

    it('answers 404 for an unknown project', async () => {
        const { user } = await seed.orgContext();

        const res = await request(ctx.app, codespaceRoutes.listByProject, {
            as: user.id,
            params: { projectId: 999999 }
        });

        expectError(res, 404, 'Codespace::NotFound');
    });

    it('returns the decrypted access info of a provisioned codespace', async () => {
        const { user, project } = await seed.orgContext();
        const created = await createCodespace(user.id, project.id);
        await Codespace.update({ id: created.data().id }, {
            accessUrl: 'http://127.0.0.1:45678',
            passwordEnc: new SecretCipher().encrypt('s3cret-password')
        });

        const res = await request(ctx.app, codespaceRoutes.access, {
            as: user.id,
            params: { id: created.data().id }
        });

        expect(res.status).toBe(200);
        expect(res.data()).toEqual({ accessUrl: 'http://127.0.0.1:45678', password: 's3cret-password' });

        await flushEvents();
    });

    it('answers 500 when access is not provisioned yet', async () => {
        const { user, project } = await seed.orgContext();
        const created = await createCodespace(user.id, project.id);

        const res = await request(ctx.app, codespaceRoutes.access, {
            as: user.id,
            params: { id: created.data().id }
        });

        expectError(res, 500, 'Codespace::ProvisionFailed');

        await flushEvents();
    });

    it('forbids access for a viewer', async () => {
        const { user, project } = await seed.orgContext(OrganizationRole.Viewer);
        const codespace = await Codespace.create({
            name: 'Viewer Box',
            organizationId: project.organizationId,
            projectId: project.id,
            userId: user.id,
            status: CodespaceStatus.Pending
        }).save();

        const res = await request(ctx.app, codespaceRoutes.access, {
            as: user.id,
            params: { id: codespace.id }
        });

        expectError(res, 403, 'Tenancy::InsufficientPermissions');
    });

    it('deletes a codespace and requests teardown', async () => {
        const { user, project } = await seed.orgContext();
        const created = await createCodespace(user.id, project.id);
        const events = collect<CodespaceProvisionRequestedPayload>('codespace.provisionRequested');

        const res = await request(ctx.app, codespaceRoutes.remove, {
            as: user.id,
            params: { id: created.data().id }
        });

        expect(res.status).toBe(204);
        expect(await Codespace.findOneBy({ id: created.data().id })).toBeNull();

        await flushEvents();
        expect(events).toEqual([{ codespaceId: created.data().id, action: 'delete', userId: user.id }]);
    });

    it('forbids delete for a viewer', async () => {
        const { user, project } = await seed.orgContext(OrganizationRole.Viewer);
        const codespace = await Codespace.create({
            name: 'Viewer Box',
            organizationId: project.organizationId,
            projectId: project.id,
            userId: user.id,
            status: CodespaceStatus.Pending
        }).save();

        const res = await request(ctx.app, codespaceRoutes.remove, {
            as: user.id,
            params: { id: codespace.id }
        });

        expectError(res, 403, 'Tenancy::InsufficientPermissions');
    });
});

describe('port binding', () => {
    const createBinding = (userId: number, overrides: Record<string, unknown> = {}) =>
        request(ctx.app, portBindingRoutes.create, {
            as: userId,
            body: { containerId: 11, internalPort: 8080, externalPort: 41000, ...overrides }
        });

    it('creates a binding stamped with the caller and requests a reload', async () => {
        const { user, org } = await seed.orgContext();
        const events = collect<PortBindingChangedPayload>('portBinding.changed');

        const res = await createBinding(user.id);

        expect(res.status).toBe(201);
        expect(res.data()).toMatchObject({
            containerId: 11,
            userId: user.id,
            organizationId: org.id,
            internalPort: 8080,
            externalPort: 41000,
            protocol: PortBindingProtocol.Tcp
        });

        await flushEvents();
        expect(events).toEqual([{ portBindingId: res.data().id, containerId: 11, action: 'create' }]);
    });

    it('rejects ports outside the valid range', async () => {
        const { user } = await seed.orgContext();

        const res = await createBinding(user.id, { externalPort: 70000 });

        expectError(res, 400, 'Request::ValidationFailed');
    });

    it('rejects a duplicate port allocation with 409', async () => {
        const { user } = await seed.orgContext();
        await createBinding(user.id);

        const res = await createBinding(user.id);

        expectError(res, 409, 'PortBinding::PortUnavailable');
    });

    it('allows the same external port for a different internal port', async () => {
        const { user } = await seed.orgContext();
        await createBinding(user.id);

        const res = await createBinding(user.id, { internalPort: 9090 });

        expect(res.status).toBe(201);
    });

    it('lists only the bindings of the caller', async () => {
        const { user, org } = await seed.orgContext();
        const other = await seed.member(org);
        await createBinding(user.id);
        await createBinding(user.id, { externalPort: 41001 });
        await createBinding(other.id, { externalPort: 41002 });

        const res = await request(ctx.app, portBindingRoutes.myBindings, { as: user.id });

        expect(res.status).toBe(200);
        expect(res.data()).toHaveLength(2);
        for(const binding of res.data()){
            expect(binding.userId).toBe(user.id);
        }
    });

    it('gets a binding as its owner', async () => {
        const { user } = await seed.orgContext();
        const created = await createBinding(user.id);

        const res = await request(ctx.app, portBindingRoutes.get, {
            as: user.id,
            params: { id: created.data().id }
        });

        expect(res.status).toBe(200);
        expect(res.data()).toMatchObject({ id: created.data().id });
    });

    it('forbids getting a binding of another user', async () => {
        const { user, org } = await seed.orgContext();
        const other = await seed.member(org);
        const created = await createBinding(user.id);

        const res = await request(ctx.app, portBindingRoutes.get, {
            as: other.id,
            params: { id: created.data().id }
        });

        expectError(res, 403, 'PortBinding::Forbidden');
    });

    it('lets a platform admin read any binding', async () => {
        const { user } = await seed.orgContext();
        const created = await createBinding(user.id);
        const admin = await seed.user(UserRole.Admin);

        const res = await request(ctx.app, portBindingRoutes.get, {
            as: admin.id,
            params: { id: created.data().id }
        });

        expect(res.status).toBe(200);
        expect(res.data()).toMatchObject({ id: created.data().id });
    });

    it('answers 404 for an unknown binding', async () => {
        const { user } = await seed.orgContext();

        const res = await request(ctx.app, portBindingRoutes.get, {
            as: user.id,
            params: { id: 999999 }
        });

        expectError(res, 404, 'PortBinding::NotFound');
    });

    it('rejects create without an organization context', async () => {
        const loner = await seed.user();

        const res = await createBinding(loner.id);

        expectError(res, 403, 'PortBinding::Forbidden');
    });

    it('deletes a binding and requests a reload', async () => {
        const { user } = await seed.orgContext();
        const created = await createBinding(user.id);
        const events = collect<PortBindingChangedPayload>('portBinding.changed');

        const res = await request(ctx.app, portBindingRoutes.remove, {
            as: user.id,
            params: { id: created.data().id }
        });

        expect(res.status).toBe(204);
        expect(await PortBinding.findOneBy({ id: created.data().id })).toBeNull();

        await flushEvents();
        expect(events).toEqual([{ portBindingId: created.data().id, containerId: 11, action: 'delete' }]);
    });

    it('forbids deleting a binding of another user', async () => {
        const { user, org } = await seed.orgContext();
        const other = await seed.member(org);
        const created = await createBinding(user.id);

        const res = await request(ctx.app, portBindingRoutes.remove, {
            as: other.id,
            params: { id: created.data().id }
        });

        expectError(res, 403, 'PortBinding::Forbidden');
    });
});
