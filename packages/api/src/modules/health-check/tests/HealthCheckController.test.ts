import { describe, expect, it } from 'vitest';
import { useApp, flushEvents } from '@tests/harness';
import { request, expectError } from '@tests/request';
import { seed } from '@tests/Seed';
import { eventBus } from '@/shared/events/EventBus';
import Repository from '@/modules/repository/models/Repository';
import { healthCheckRoutes } from '@quantum/contracts/modules/health-check/routes';
import { HealthCheckStatus, HealthCheckType } from '@quantum/contracts/modules/health-check/domain';
import { OrganizationRole } from '@quantum/contracts/modules/organization/domain';
import { UserRole } from '@quantum/contracts/modules/user/domain';
import HealthCheck from '../models/HealthCheck';
import type { HealthCheckChangedPayload } from '../contracts/domain/events';

const ctx = useApp();

interface RepositorySeed{
    organizationId: number;
    projectId: number;
    userId: number;
}

let repositorySeq = 0;

const createRepository = async (options: RepositorySeed): Promise<number> => {
    const n = ++repositorySeq;
    const repository = await Repository.create({
        name: `repo-${n}`,
        alias: `repo-${n}`,
        url: `https://git.example.com/repo-${n}.git`,
        organizationId: options.organizationId,
        projectId: options.projectId,
        userId: options.userId
    }).save();
    return repository.id;
};

const collect = <T>(event: keyof EventMap): T[] => {
    const received: T[] = [];
    eventBus.subscribe(event, (payload) => {
        received.push(payload as T);
    });
    return received;
};

const seedCheck = (organizationId: number, repositoryId: number) => HealthCheck.create({
    organizationId,
    repositoryId
}).save();

describe('health check', () => {
    it('rejects unauthenticated requests', async () => {
        const res = await request(ctx.app, healthCheckRoutes.listByRepository, { params: { repositoryId: 1 } });

        expectError(res, 401, 'Authentication::Unauthorized');
    });

    it('creates a health check with defaults from the repository', async () => {
        const { user, org, project } = await seed.orgContext();
        const repositoryId = await createRepository({ organizationId: org.id, projectId: project.id, userId: user.id });
        const events = collect<HealthCheckChangedPayload>('healthcheck.changed');

        const res = await request(ctx.app, healthCheckRoutes.create, {
            as: user.id,
            params: { repositoryId },
            body: {}
        });

        expect(res.status).toBe(201);
        expect(res.data()).toMatchObject({
            organizationId: org.id,
            repositoryId,
            projectId: project.id,
            userId: user.id,
            type: HealthCheckType.Http,
            path: '/',
            port: null,
            command: null,
            intervalSec: 30,
            timeoutSec: 5,
            healthyThreshold: 2,
            unhealthyThreshold: 3,
            enabled: true,
            autoRestart: false,
            gateDeploy: false,
            status: HealthCheckStatus.Unknown
        });

        await flushEvents();
        expect(events).toEqual([{ healthCheckId: res.data().id, action: 'create' }]);
    });

    it('creates a health check with a full body', async () => {
        const { user, org, project } = await seed.orgContext();
        const repositoryId = await createRepository({ organizationId: org.id, projectId: project.id, userId: user.id });

        const res = await request(ctx.app, healthCheckRoutes.create, {
            as: user.id,
            params: { repositoryId },
            body: {
                type: HealthCheckType.Tcp,
                port: 8080,
                intervalSec: 60,
                timeoutSec: 10,
                healthyThreshold: 3,
                unhealthyThreshold: 5,
                enabled: false,
                autoRestart: true,
                gateDeploy: true
            }
        });

        expect(res.status).toBe(201);
        expect(res.data()).toMatchObject({
            type: HealthCheckType.Tcp,
            port: 8080,
            intervalSec: 60,
            timeoutSec: 10,
            healthyThreshold: 3,
            unhealthyThreshold: 5,
            enabled: false,
            autoRestart: true,
            gateDeploy: true
        });

        await flushEvents();
    });

    it('rejects an invalid create body', async () => {
        const { user, org, project } = await seed.orgContext();
        const repositoryId = await createRepository({ organizationId: org.id, projectId: project.id, userId: user.id });

        const badPort = await request(ctx.app, healthCheckRoutes.create, {
            as: user.id,
            params: { repositoryId },
            body: { port: 0 }
        });
        expectError(badPort, 400, 'Request::ValidationFailed');

        const badInterval = await request(ctx.app, healthCheckRoutes.create, {
            as: user.id,
            params: { repositoryId },
            body: { intervalSec: 4 }
        });
        expectError(badInterval, 400, 'Request::ValidationFailed');
    });

    it('forbids create for a viewer', async () => {
        const { user, org, project } = await seed.orgContext(OrganizationRole.Viewer);
        const repositoryId = await createRepository({ organizationId: org.id, projectId: project.id, userId: user.id });

        const res = await request(ctx.app, healthCheckRoutes.create, {
            as: user.id,
            params: { repositoryId },
            body: {}
        });

        expectError(res, 403, 'Tenancy::InsufficientPermissions');
    });

    it('lets a member create through project membership', async () => {
        const { user, org, project } = await seed.orgContext();
        const member = await seed.member(org);
        const repositoryId = await createRepository({ organizationId: org.id, projectId: project.id, userId: user.id });

        const res = await request(ctx.app, healthCheckRoutes.create, {
            as: member.id,
            params: { repositoryId },
            body: {}
        });

        expect(res.status).toBe(201);
        expect(res.data()).toMatchObject({ repositoryId, organizationId: org.id });

        await flushEvents();
    });

    it('lets the repository owner create without project membership', async () => {
        const { user, org } = await seed.orgContext();
        const foreign = await seed.orgContext();
        const repositoryId = await createRepository({
            organizationId: org.id,
            projectId: foreign.project.id,
            userId: user.id
        });

        const res = await request(ctx.app, healthCheckRoutes.create, {
            as: user.id,
            params: { repositoryId },
            body: { type: HealthCheckType.Cmd, command: 'pg_isready' }
        });

        expect(res.status).toBe(201);
        expect(res.data()).toMatchObject({
            type: HealthCheckType.Cmd,
            command: 'pg_isready',
            projectId: foreign.project.id,
            userId: user.id
        });

        await flushEvents();
    });

    it('answers 404 for an unknown repository', async () => {
        const { user } = await seed.orgContext();

        const res = await request(ctx.app, healthCheckRoutes.create, {
            as: user.id,
            params: { repositoryId: 999999 },
            body: {}
        });

        expectError(res, 404, 'HealthCheck::NotFound');
    });

    it('forbids create on an inaccessible repository', async () => {
        const owner = await seed.orgContext();
        const outsider = await seed.orgContext();
        const repositoryId = await createRepository({
            organizationId: outsider.org.id,
            projectId: outsider.project.id,
            userId: outsider.user.id
        });

        const res = await request(ctx.app, healthCheckRoutes.create, {
            as: owner.user.id,
            params: { repositoryId },
            body: {}
        });

        expectError(res, 403, 'HealthCheck::Forbidden');
    });

    it('lists health checks scoped to the repository', async () => {
        const { user, org, project } = await seed.orgContext();
        const repositoryId = await createRepository({ organizationId: org.id, projectId: project.id, userId: user.id });
        const otherRepositoryId = await createRepository({ organizationId: org.id, projectId: project.id, userId: user.id });
        await request(ctx.app, healthCheckRoutes.create, { as: user.id, params: { repositoryId }, body: {} });
        await request(ctx.app, healthCheckRoutes.create, { as: user.id, params: { repositoryId }, body: { port: 8080 } });
        await request(ctx.app, healthCheckRoutes.create, { as: user.id, params: { repositoryId: otherRepositoryId }, body: {} });

        const res = await request(ctx.app, healthCheckRoutes.listByRepository, {
            as: user.id,
            params: { repositoryId }
        });

        expect(res.status).toBe(200);
        expect(res.data()).toHaveLength(2);
        for(const healthCheck of res.data()){
            expect(healthCheck.repositoryId).toBe(repositoryId);
        }

        await flushEvents();
    });

    it('forbids listing health checks of an inaccessible repository', async () => {
        const owner = await seed.orgContext();
        const outsider = await seed.orgContext();
        const repositoryId = await createRepository({
            organizationId: owner.org.id,
            projectId: owner.project.id,
            userId: owner.user.id
        });

        const res = await request(ctx.app, healthCheckRoutes.listByRepository, {
            as: outsider.user.id,
            params: { repositoryId }
        });

        expectError(res, 403, 'HealthCheck::Forbidden');
    });

    it('gets a health check as an org member', async () => {
        const { user, org, project } = await seed.orgContext();
        const repositoryId = await createRepository({ organizationId: org.id, projectId: project.id, userId: user.id });
        const created = await request(ctx.app, healthCheckRoutes.create, { as: user.id, params: { repositoryId }, body: {} });

        const res = await request(ctx.app, healthCheckRoutes.get, {
            as: user.id,
            params: { id: created.data().id }
        });

        expect(res.status).toBe(200);
        expect(res.data()).toMatchObject({ id: created.data().id, repositoryId });

        await flushEvents();
    });

    it('forbids getting a health check of another organization', async () => {
        const owner = await seed.orgContext();
        const outsider = await seed.orgContext();
        const repositoryId = await createRepository({
            organizationId: owner.org.id,
            projectId: owner.project.id,
            userId: owner.user.id
        });
        const created = await request(ctx.app, healthCheckRoutes.create, {
            as: owner.user.id,
            params: { repositoryId },
            body: {}
        });

        const res = await request(ctx.app, healthCheckRoutes.get, {
            as: outsider.user.id,
            params: { id: created.data().id }
        });

        expectError(res, 403, 'HealthCheck::Forbidden');

        await flushEvents();
    });

    it('answers 404 for an unknown health check', async () => {
        const { user } = await seed.orgContext();

        const res = await request(ctx.app, healthCheckRoutes.get, {
            as: user.id,
            params: { id: 999999 }
        });

        expectError(res, 404, 'HealthCheck::NotFound');
    });

    it('lets a platform admin bypass health check ownership', async () => {
        const { user, org, project } = await seed.orgContext();
        const repositoryId = await createRepository({ organizationId: org.id, projectId: project.id, userId: user.id });
        const created = await request(ctx.app, healthCheckRoutes.create, { as: user.id, params: { repositoryId }, body: {} });
        const admin = await seed.user(UserRole.Admin);

        const res = await request(ctx.app, healthCheckRoutes.get, {
            as: admin.id,
            params: { id: created.data().id }
        });

        expect(res.status).toBe(200);
        expect(res.data()).toMatchObject({ id: created.data().id });

        await flushEvents();
    });

    it('updates a health check and notifies', async () => {
        const { user, org, project } = await seed.orgContext();
        const repositoryId = await createRepository({ organizationId: org.id, projectId: project.id, userId: user.id });
        const created = await request(ctx.app, healthCheckRoutes.create, {
            as: user.id,
            params: { repositoryId },
            body: { port: 8080 }
        });
        const events = collect<HealthCheckChangedPayload>('healthcheck.changed');

        const res = await request(ctx.app, healthCheckRoutes.update, {
            as: user.id,
            params: { id: created.data().id },
            body: { path: '/ready', intervalSec: 60, enabled: false, port: null }
        });

        expect(res.status).toBe(200);
        expect(res.data()).toMatchObject({
            id: created.data().id,
            path: '/ready',
            intervalSec: 60,
            enabled: false,
            port: null
        });

        await flushEvents();
        expect(events).toEqual([{ healthCheckId: created.data().id, action: 'update' }]);
    });

    it('forbids update for a viewer', async () => {
        const { user, org } = await seed.orgContext(OrganizationRole.Viewer);
        const healthCheck = await seedCheck(org.id, 1);

        const res = await request(ctx.app, healthCheckRoutes.update, {
            as: user.id,
            params: { id: healthCheck.id },
            body: { enabled: false }
        });

        expectError(res, 403, 'Tenancy::InsufficientPermissions');
    });

    it('answers 404 when updating an unknown health check', async () => {
        const { user } = await seed.orgContext();

        const res = await request(ctx.app, healthCheckRoutes.update, {
            as: user.id,
            params: { id: 999999 },
            body: { enabled: false }
        });

        expectError(res, 404, 'HealthCheck::NotFound');
    });

    it('deletes a health check and notifies', async () => {
        const { user, org, project } = await seed.orgContext();
        const repositoryId = await createRepository({ organizationId: org.id, projectId: project.id, userId: user.id });
        const created = await request(ctx.app, healthCheckRoutes.create, { as: user.id, params: { repositoryId }, body: {} });
        const events = collect<HealthCheckChangedPayload>('healthcheck.changed');

        const res = await request(ctx.app, healthCheckRoutes.remove, {
            as: user.id,
            params: { id: created.data().id }
        });

        expect(res.status).toBe(204);
        expect(await HealthCheck.findOneBy({ id: created.data().id })).toBeNull();

        await flushEvents();
        expect(events).toEqual([{ healthCheckId: created.data().id, action: 'delete' }]);
    });

    it('forbids delete for a viewer', async () => {
        const { user, org } = await seed.orgContext(OrganizationRole.Viewer);
        const healthCheck = await seedCheck(org.id, 1);

        const res = await request(ctx.app, healthCheckRoutes.remove, {
            as: user.id,
            params: { id: healthCheck.id }
        });

        expectError(res, 403, 'Tenancy::InsufficientPermissions');
    });
});
