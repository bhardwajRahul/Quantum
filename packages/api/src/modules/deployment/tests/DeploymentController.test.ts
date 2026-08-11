import { describe, expect, it } from 'vitest';
import { useApp, authHeader } from '@tests/harness';
import { request, expectError } from '@tests/request';
import { seed } from '@tests/Seed';
import { UserRole } from '@quantum/contracts/modules/user/domain';
import { DeploymentStatus, JobType } from '@quantum/contracts/modules/deployment/domain';
import { RepositoryOperation } from '@quantum/contracts/modules/repository/domain';
import { deploymentRoutes } from '@quantum/contracts/modules/deployment/routes';
import Repository from '@/modules/repository/models/Repository';
import Deployment from '../models/Deployment';
import Job from '../models/Job';

const ctx = useApp();

const createRepository = async (userId: number, organizationId: number, projectId: number, alias: string) =>
    Repository.create({
        name: alias,
        alias,
        url: `https://github.com/acme/${alias}`,
        userId,
        organizationId,
        projectId
    }).save();

const createDeployment = async (repository: Repository, overrides: Record<string, unknown> = {}) =>
    Deployment.create({
        repositoryId: repository.id,
        userId: repository.userId,
        organizationId: repository.organizationId,
        environmentId: null,
        githubDeploymentId: null,
        status: DeploymentStatus.Success,
        commit: null,
        artifact: null,
        url: null,
        environmentVariables: {},
        ...overrides
    }).save();

describe('deployment controller', () => {
    it('rejects unauthenticated requests', async () => {
        const res = await request(ctx.app, deploymentRoutes.listAll);
        expectError(res, 401, 'Authentication::Unauthorized');
    });

    it('lists deployments for a repository the caller owns', async () => {
        const { user, org, project } = await seed.orgContext();
        const repository = await createRepository(user.id, org.id, project.id, 'web-app');
        await createDeployment(repository);
        await createDeployment(repository, { status: DeploymentStatus.Failure });

        const res = await request(ctx.app, deploymentRoutes.listByRepository, {
            as: user.id,
            params: { repositoryId: repository.id }
        });

        expect(res.status).toBe(200);
        expect(res.data()).toHaveLength(2);
    });

    it('forbids listing deployments for a repository in a foreign org', async () => {
        const { user, org, project } = await seed.orgContext();
        const repository = await createRepository(user.id, org.id, project.id, 'web-app');
        await createDeployment(repository);
        const outsider = await seed.user();

        const res = await request(ctx.app, deploymentRoutes.listByRepository, {
            as: outsider.id,
            params: { repositoryId: repository.id }
        });

        expectError(res, 403, 'Repository::Forbidden');
    });

    it('returns the active deployment environment variables', async () => {
        const { user, org, project } = await seed.orgContext();
        const repository = await createRepository(user.id, org.id, project.id, 'web-app');
        await createDeployment(repository, { environmentVariables: { NODE_ENV: 'production', PORT: '8080' } });

        const res = await request(ctx.app, deploymentRoutes.environment, {
            as: user.id,
            params: { repositoryId: repository.id }
        });

        expect(res.status).toBe(200);
        expect(res.data()).toMatchObject({ environmentVariables: { NODE_ENV: 'production', PORT: '8080' } });
    });

    it('answers 404 when the repository has no deployment', async () => {
        const { user, org, project } = await seed.orgContext();
        const repository = await createRepository(user.id, org.id, project.id, 'web-app');

        const res = await request(ctx.app, deploymentRoutes.environment, {
            as: user.id,
            params: { repositoryId: repository.id }
        });

        expectError(res, 404, 'Deployment::NotFound');
    });

    it('accepts a lifecycle operation and enqueues a job', async () => {
        const { user, org, project } = await seed.orgContext();
        const repository = await createRepository(user.id, org.id, project.id, 'web-app');

        const res = await request(ctx.app, deploymentRoutes.operate, {
            as: user.id,
            params: { repositoryId: repository.id },
            body: { operation: RepositoryOperation.Restart }
        });

        expect(res.status).toBe(202);
        expect(res.data()).toMatchObject({ status: 'queued', action: 'restart' });
        expect(typeof res.data().jobId).toBe('number');

        const jobs = await Job.find({ where: { repositoryId: repository.id } });
        expect(jobs).toHaveLength(1);
        expect(jobs[0].type).toBe('restart');
        expect(jobs[0].lockKey).toBe(`repo:${repository.id}`);
    });

    it('forbids an operation for a foreign user', async () => {
        const { user, org, project } = await seed.orgContext();
        const repository = await createRepository(user.id, org.id, project.id, 'web-app');
        const outsider = await seed.user();

        const res = await request(ctx.app, deploymentRoutes.operate, {
            as: outsider.id,
            params: { repositoryId: repository.id },
            body: { operation: RepositoryOperation.Stop }
        });

        expectError(res, 403, 'Repository::Forbidden');
    });

    it('gets a deployment as its owner', async () => {
        const { user, org, project } = await seed.orgContext();
        const repository = await createRepository(user.id, org.id, project.id, 'web-app');
        const deployment = await createDeployment(repository);

        const res = await request(ctx.app, deploymentRoutes.get, {
            as: user.id,
            params: { id: deployment.id }
        });

        expect(res.status).toBe(200);
        expect(res.data()).toMatchObject({ id: deployment.id, status: 'success' });
    });

    it('lets an org member access a deployment through project access', async () => {
        const { user, org, project } = await seed.orgContext();
        const repository = await createRepository(user.id, org.id, project.id, 'web-app');
        const deployment = await createDeployment(repository);
        const member = await seed.member(org);

        const res = await request(ctx.app, deploymentRoutes.get, {
            as: member.id,
            params: { id: deployment.id }
        });

        expect(res.status).toBe(200);
        expect(res.data().id).toBe(deployment.id);
    });

    it('forbids getting a deployment for a foreign user', async () => {
        const { user, org, project } = await seed.orgContext();
        const repository = await createRepository(user.id, org.id, project.id, 'web-app');
        const deployment = await createDeployment(repository);
        const outsider = await seed.user();

        const res = await request(ctx.app, deploymentRoutes.get, {
            as: outsider.id,
            params: { id: deployment.id }
        });

        expectError(res, 403, 'Deployment::Forbidden');
    });

    it('lets a platform admin bypass deployment ownership', async () => {
        const { user, org, project } = await seed.orgContext();
        const repository = await createRepository(user.id, org.id, project.id, 'web-app');
        const deployment = await createDeployment(repository);
        const admin = await seed.user(UserRole.Admin);

        const res = await request(ctx.app, deploymentRoutes.get, {
            as: admin.id,
            params: { id: deployment.id }
        });

        expect(res.status).toBe(200);
        expect(res.data().id).toBe(deployment.id);
    });

    it('updates deployment environment variables', async () => {
        const { user, org, project } = await seed.orgContext();
        const repository = await createRepository(user.id, org.id, project.id, 'web-app');
        const deployment = await createDeployment(repository);

        const res = await request(ctx.app, deploymentRoutes.update, {
            as: user.id,
            params: { id: deployment.id },
            body: { environmentVariables: { API_KEY: 'secret-value' } }
        });

        expect(res.status).toBe(200);
        expect(res.data().environmentVariables).toEqual({ API_KEY: 'secret-value' });

        const fresh = await Deployment.findOneBy({ id: deployment.id });
        expect(fresh?.environmentVariables).toEqual({ API_KEY: 'secret-value' });
    });

    it('forbids updating a deployment for a foreign user', async () => {
        const { user, org, project } = await seed.orgContext();
        const repository = await createRepository(user.id, org.id, project.id, 'web-app');
        const deployment = await createDeployment(repository);
        const outsider = await seed.user();

        const res = await request(ctx.app, deploymentRoutes.update, {
            as: outsider.id,
            params: { id: deployment.id },
            body: { environmentVariables: { HACK: '1' } }
        });

        expectError(res, 403, 'Deployment::Forbidden');
    });

    it('deletes a deployment as its owner', async () => {
        const { user, org, project } = await seed.orgContext();
        const repository = await createRepository(user.id, org.id, project.id, 'web-app');
        const deployment = await createDeployment(repository);

        const res = await request(ctx.app, deploymentRoutes.remove, {
            as: user.id,
            params: { id: deployment.id }
        });

        expect(res.status).toBe(204);
        expect(await Deployment.findOneBy({ id: deployment.id })).toBeNull();
    });

    it('lists every deployment for a platform admin', async () => {
        const first = await seed.orgContext();
        const second = await seed.orgContext();
        const repoA = await createRepository(first.user.id, first.org.id, first.project.id, 'app-one');
        const repoB = await createRepository(second.user.id, second.org.id, second.project.id, 'app-two');
        await createDeployment(repoA);
        await createDeployment(repoB);
        const admin = await seed.user(UserRole.Admin);

        const res = await request(ctx.app, deploymentRoutes.listAll, { as: admin.id });

        expect(res.status).toBe(200);
        expect(res.data()).toHaveLength(2);
    });

    it('forbids the admin deployment list for a regular user', async () => {
        const { user } = await seed.orgContext();
        const res = await request(ctx.app, deploymentRoutes.listAll, { as: user.id });
        expectError(res, 403, 'Authentication::Forbidden');
    });

    it('scopes the job list to the caller tenant', async () => {
        const { user, org } = await seed.orgContext();
        const other = await seed.orgContext();
        await Job.create({ type: JobType.Deploy, organizationId: org.id, payload: {} }).save();
        await Job.create({ type: JobType.Deploy, organizationId: other.org.id, payload: {} }).save();

        const res = await request(ctx.app, deploymentRoutes.jobs, { as: user.id });

        expect(res.status).toBe(200);
        expect(res.data()).toHaveLength(1);
        expect(res.data()[0].organizationId).toBe(org.id);
    });

    it('returns all jobs to a platform admin', async () => {
        const { org } = await seed.orgContext();
        const other = await seed.orgContext();
        await Job.create({ type: JobType.Deploy, organizationId: org.id, payload: {} }).save();
        await Job.create({ type: JobType.Deploy, organizationId: other.org.id, payload: {} }).save();
        const admin = await seed.user(UserRole.Admin);

        const res = await request(ctx.app, deploymentRoutes.jobs, { as: admin.id });

        expect(res.status).toBe(200);
        expect(res.data()).toHaveLength(2);
    });
});

describe('deployment gateway auth', () => {
    it('rejects an unauthenticated websocket upgrade', async () => {
        await expect(ctx.app.injectWS('/deployment/stream')).rejects.toThrow(/401/);
    });

    it('rejects a websocket upgrade with an invalid token', async () => {
        await expect(ctx.app.injectWS('/deployment/stream?token=not-a-jwt')).rejects.toThrow(/401/);
    });

    it('accepts an authenticated websocket connection', async () => {
        const { user } = await seed.orgContext();
        const token = authHeader(user.id).authorization.slice('Bearer '.length);

        const ws = await ctx.app.injectWS(`/deployment/stream?token=${token}`);
        expect(ws).toBeDefined();
        ws.close();
    });
});
