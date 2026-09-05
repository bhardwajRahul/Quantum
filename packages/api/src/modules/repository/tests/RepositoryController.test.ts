import { createHmac } from 'node:crypto';
import { beforeEach, describe, expect, it } from 'vitest';
import { useApp, flushEvents } from '@tests/harness';
import { request, expectError } from '@tests/request';
import { seed } from '@tests/Seed';
import { config } from '@/shared/config';
import { eventBus } from '@/shared/events/EventBus';
import { repositoryRoutes } from '@quantum/contracts/modules/repository/routes';
import { UserRole } from '@quantum/contracts/modules/user/domain';
import Repository from '../models/Repository';

const ctx = useApp();

const deploymentRequests: unknown[] = [];
const rollbackRequests: unknown[] = [];
eventBus.subscribe('deployment.requested', (payload) => { deploymentRequests.push(payload); });
eventBus.subscribe('deployment.rollbackRequested', (payload) => { rollbackRequests.push(payload); });

beforeEach(() => {
    deploymentRequests.length = 0;
    rollbackRequests.length = 0;
});

const createRepository = (userId: number, projectId: number, body: Record<string, unknown> = {}) =>
    request(ctx.app, repositoryRoutes.create, {
        as: userId,
        body: { name: 'My App', url: 'https://github.com/acme/my-app', projectId, ...body }
    });

/**
 * Creating a repository requests its first deployment, so a test that asserts on what
 * a *later* action emitted drains the recorded events once the setup create is done.
 */
const createRepositoryThenDrain = async (
    userId: number,
    projectId: number,
    body: Record<string, unknown> = {}
) => {
    const created = await createRepository(userId, projectId, body);
    await flushEvents();
    deploymentRequests.length = 0;
    return created;
};

const sign = (raw: string): string =>
    'sha256=' + createHmac('sha256', config.jwtSecret).update(raw).digest('hex');

const injectWebhook = (repositoryId: number, raw: string, signature?: string) =>
    ctx.app.inject({
        method: repositoryRoutes.webhook.method,
        url: repositoryRoutes.webhook.path.replace(':repositoryId', String(repositoryId)),
        headers: signature === undefined
            ? { 'content-type': 'application/json' }
            : { 'content-type': 'application/json', 'x-hub-signature-256': signature },
        payload: raw
    });

describe('repository', () => {
    it('rejects unauthenticated requests', async () => {
        const res = await request(ctx.app, repositoryRoutes.mine);

        expectError(res, 401, 'Authentication::Unauthorized');
    });

    it('creates a repository with defaults derived from the name', async () => {
        const { user, org, project } = await seed.orgContext();

        const res = await createRepository(user.id, project.id);

        expect(res.status).toBe(201);
        expect(res.data()).toMatchObject({
            name: 'My App',
            alias: 'My App',
            branch: 'main',
            webhookId: null,
            // Derived from the container row at request time, so a repository that has
            // never been provisioned reports no runtime state rather than "stopped".
            containerStatus: null,
            buildStrategy: 'exec',
            sourceType: 'github',
            userId: user.id,
            organizationId: org.id,
            projectId: project.id,
            environmentId: null
        });

        await flushEvents();
    });

    it('requests the first deployment as soon as the repository is created', async () => {
        const { user, project } = await seed.orgContext();

        const res = await createRepository(user.id, project.id);
        await flushEvents();

        expect(res.status).toBe(201);
        expect(deploymentRequests).toEqual([{
            repositoryId: res.data().id,
            reason: 'create',
            commit: null,
            userId: user.id
        }]);
    });

    it('uses the provided alias', async () => {
        const { user, project } = await seed.orgContext();

        const res = await createRepository(user.id, project.id, { alias: 'custom-alias' });

        expect(res.status).toBe(201);
        expect(res.data().alias).toBe('custom-alias');
    });

    it('rejects an alias shorter than four characters', async () => {
        const { user, project } = await seed.orgContext();

        const explicit = await createRepository(user.id, project.id, { alias: 'ab' });
        expectError(explicit, 400, 'Request::ValidationFailed');

        const derived = await createRepository(user.id, project.id, { name: 'ab' });
        expectError(derived, 400, 'Request::ValidationFailed');
    });

    it('rejects a duplicate alias within the organization', async () => {
        const { user, project } = await seed.orgContext();

        await createRepository(user.id, project.id, { alias: 'webapp' });
        const res = await createRepository(user.id, project.id, {
            name: 'Second App',
            url: 'https://github.com/acme/second-app',
            alias: 'webapp'
        });

        expectError(res, 409, 'Repository::AliasAlreadyTaken');
    });

    it('rejects create for a project outside the tenant scope', async () => {
        const { user } = await seed.orgContext();
        const foreign = await seed.orgContext();

        const res = await createRepository(user.id, foreign.project.id);

        expectError(res, 403, 'Tenancy::ProjectForbidden');
    });

    it('lists only repositories owned by the caller', async () => {
        const { user, project } = await seed.orgContext();
        await createRepository(user.id, project.id, { alias: 'first-app' });
        await createRepository(user.id, project.id, {
            name: 'Second App',
            url: 'https://github.com/acme/second-app',
            alias: 'second-app'
        });
        const other = await seed.orgContext();
        await createRepository(other.user.id, other.project.id);

        const res = await request(ctx.app, repositoryRoutes.mine, { as: user.id });

        expect(res.status).toBe(200);
        expect(res.data()).toHaveLength(2);
        for(const repository of res.data()){
            expect(repository.userId).toBe(user.id);
        }
    });

    it('gets a repository as its owner', async () => {
        const { user, project } = await seed.orgContext();
        const created = await createRepository(user.id, project.id);

        const res = await request(ctx.app, repositoryRoutes.get, {
            as: user.id,
            params: { id: created.data().id }
        });

        expect(res.status).toBe(200);
        expect(res.data()).toMatchObject({ id: created.data().id, name: 'My App' });
    });

    it('gets a repository as an org member through project access', async () => {
        const { user, org, project } = await seed.orgContext();
        const created = await createRepository(user.id, project.id);
        const member = await seed.member(org);

        const res = await request(ctx.app, repositoryRoutes.get, {
            as: member.id,
            params: { id: created.data().id }
        });

        expect(res.status).toBe(200);
        expect(res.data().id).toBe(created.data().id);
    });

    it('forbids getting a repository for a foreign user', async () => {
        const { user, project } = await seed.orgContext();
        const created = await createRepository(user.id, project.id);
        const outsider = await seed.user();

        const res = await request(ctx.app, repositoryRoutes.get, {
            as: outsider.id,
            params: { id: created.data().id }
        });

        expectError(res, 403, 'Repository::Forbidden');
    });

    it('answers 404 for an unknown repository', async () => {
        const { user } = await seed.orgContext();

        const res = await request(ctx.app, repositoryRoutes.get, {
            as: user.id,
            params: { id: 999999 }
        });

        expectError(res, 404, 'Repository::NotFound');
    });

    it('lets a platform admin bypass repository ownership', async () => {
        const { user, project } = await seed.orgContext();
        const created = await createRepository(user.id, project.id);
        const admin = await seed.user(UserRole.Admin);

        const res = await request(ctx.app, repositoryRoutes.get, {
            as: admin.id,
            params: { id: created.data().id }
        });

        expect(res.status).toBe(200);
        expect(res.data().id).toBe(created.data().id);
    });

    it('updates a repository as owner', async () => {
        const { user, project } = await seed.orgContext();
        const created = await createRepository(user.id, project.id);

        const res = await request(ctx.app, repositoryRoutes.update, {
            as: user.id,
            params: { id: created.data().id },
            body: { name: 'Renamed App', buildCommand: 'pnpm build' }
        });

        expect(res.status).toBe(200);
        expect(res.data()).toMatchObject({
            id: created.data().id,
            name: 'Renamed App',
            buildCommand: 'pnpm build'
        });

        await flushEvents();
    });

    it('requests a redeploy when build fields change', async () => {
        const { user, project } = await seed.orgContext();
        const created = await createRepositoryThenDrain(user.id, project.id);

        await request(ctx.app, repositoryRoutes.update, {
            as: user.id,
            params: { id: created.data().id },
            body: { branch: 'develop' }
        });

        await flushEvents();
        expect(deploymentRequests).toHaveLength(1);
        expect(deploymentRequests[0]).toMatchObject({
            repositoryId: created.data().id,
            reason: 'manual',
            commit: null,
            userId: user.id
        });
    });

    it('does not request a redeploy for a port-only change', async () => {
        const { user, project } = await seed.orgContext();
        const created = await createRepositoryThenDrain(user.id, project.id);

        await request(ctx.app, repositoryRoutes.update, {
            as: user.id,
            params: { id: created.data().id },
            body: { port: 8080 }
        });

        await flushEvents();
        expect(deploymentRequests).toHaveLength(0);
    });

    it('rejects renaming to a taken alias with 409', async () => {
        const { user, project } = await seed.orgContext();
        await createRepository(user.id, project.id, { alias: 'webapp' });
        const second = await createRepository(user.id, project.id, {
            name: 'Second App',
            url: 'https://github.com/acme/second-app',
            alias: 'second-app'
        });

        const res = await request(ctx.app, repositoryRoutes.update, {
            as: user.id,
            params: { id: second.data().id },
            body: { alias: 'webapp' }
        });

        expectError(res, 409, 'Repository::AliasAlreadyTaken');
    });

    it('forbids update for a foreign user', async () => {
        const { user, project } = await seed.orgContext();
        const created = await createRepository(user.id, project.id);
        const outsider = await seed.user();

        const res = await request(ctx.app, repositoryRoutes.update, {
            as: outsider.id,
            params: { id: created.data().id },
            body: { name: 'Hijacked' }
        });

        expectError(res, 403, 'Repository::Forbidden');
    });

    it('deletes a repository as owner', async () => {
        const { user, project } = await seed.orgContext();
        const created = await createRepository(user.id, project.id);

        const res = await request(ctx.app, repositoryRoutes.remove, {
            as: user.id,
            params: { id: created.data().id }
        });

        expect(res.status).toBe(204);
        expect(await Repository.findOneBy({ id: created.data().id })).toBeNull();
    });

    it('forbids delete for a foreign user', async () => {
        const { user, project } = await seed.orgContext();
        const created = await createRepository(user.id, project.id);
        const outsider = await seed.user();

        const res = await request(ctx.app, repositoryRoutes.remove, {
            as: outsider.id,
            params: { id: created.data().id }
        });

        expectError(res, 403, 'Repository::Forbidden');
        expect(await Repository.findOneBy({ id: created.data().id })).not.toBeNull();
    });

    it('requests a rollback for a deployment', async () => {
        const { user, project } = await seed.orgContext();
        const created = await createRepository(user.id, project.id);

        const res = await request(ctx.app, repositoryRoutes.rollback, {
            as: user.id,
            params: { id: created.data().id, deploymentId: 42 }
        });

        expect(res.status).toBe(202);
        expect(res.data()).toEqual({ repositoryId: created.data().id, deploymentId: 42 });

        await flushEvents();
        expect(rollbackRequests).toHaveLength(1);
        expect(rollbackRequests[0]).toMatchObject({
            repositoryId: created.data().id,
            deploymentId: 42,
            userId: user.id
        });
    });

    it('forbids rollback for a foreign user', async () => {
        const { user, project } = await seed.orgContext();
        const created = await createRepository(user.id, project.id);
        const outsider = await seed.user();

        const res = await request(ctx.app, repositoryRoutes.rollback, {
            as: outsider.id,
            params: { id: created.data().id, deploymentId: 42 }
        });

        expectError(res, 403, 'Repository::Forbidden');
    });

});

describe('webhook', () => {
    it('rejects a payload with an invalid signature', async () => {
        const { user, project } = await seed.orgContext();
        const created = await createRepository(user.id, project.id);
        const raw = JSON.stringify({ pusher: { name: 'acme' }, ref: 'refs/heads/main' });

        const res = await injectWebhook(created.data().id, raw, sign('a-different-body'));

        expect(res.statusCode).toBe(401);
        expect(res.json()).toMatchObject({ error: 'Repository::InvalidSignature' });
    });

    it('rejects a payload without a signature', async () => {
        const { user, project } = await seed.orgContext();
        const created = await createRepository(user.id, project.id);
        const raw = JSON.stringify({ pusher: { name: 'acme' }, ref: 'refs/heads/main' });

        const res = await injectWebhook(created.data().id, raw);

        expect(res.statusCode).toBe(401);
        expect(res.json()).toMatchObject({ error: 'Repository::InvalidSignature' });
    });

    it('accepts a signed push and requests a deployment', async () => {
        const { user, project } = await seed.orgContext();
        const created = await createRepositoryThenDrain(user.id, project.id);
        const raw = JSON.stringify({
            pusher: { name: 'acme' },
            ref: 'refs/heads/main',
            after: 'abc123'
        });

        const res = await injectWebhook(created.data().id, raw, sign(raw));

        expect(res.statusCode).toBe(202);
        expect(res.json()).toEqual({ data: { skipped: false } });

        await flushEvents();
        expect(deploymentRequests).toHaveLength(1);
        expect(deploymentRequests[0]).toMatchObject({
            repositoryId: created.data().id,
            reason: 'push',
            commit: 'abc123',
            userId: user.id
        });
    });

    it('tracks the repository branch', async () => {
        const { user, project } = await seed.orgContext();
        const created = await createRepositoryThenDrain(user.id, project.id, { branch: 'develop' });
        const raw = JSON.stringify({ pusher: { name: 'acme' }, ref: 'refs/heads/develop', after: 'def456' });

        const res = await injectWebhook(created.data().id, raw, sign(raw));

        expect(res.statusCode).toBe(202);

        await flushEvents();
        expect(deploymentRequests[0]).toMatchObject({ repositoryId: created.data().id, commit: 'def456' });
    });

    it('skips a push to another branch', async () => {
        const { user, project } = await seed.orgContext();
        const created = await createRepositoryThenDrain(user.id, project.id);
        const raw = JSON.stringify({ pusher: { name: 'acme' }, ref: 'refs/heads/feature', after: 'abc123' });

        const res = await injectWebhook(created.data().id, raw, sign(raw));

        expect(res.statusCode).toBe(200);
        expect(res.json()).toEqual({ data: { skipped: true, reason: 'branch-mismatch' } });

        await flushEvents();
        expect(deploymentRequests).toHaveLength(0);
    });

    it('acknowledges payloads without a pusher', async () => {
        const { user, project } = await seed.orgContext();
        const created = await createRepository(user.id, project.id);
        const raw = JSON.stringify({ zen: 'ping' });

        const res = await injectWebhook(created.data().id, raw, sign(raw));

        expect(res.statusCode).toBe(200);
        expect(res.json()).toEqual({ data: { ok: true } });
    });

    it('answers 404 for an unknown repository', async () => {
        const raw = JSON.stringify({ pusher: { name: 'acme' }, ref: 'refs/heads/main' });

        const res = await injectWebhook(999999, raw, sign(raw));

        expect(res.statusCode).toBe(404);
        expect(res.json()).toMatchObject({ error: 'Repository::NotFound' });
    });
});
