import { beforeEach, describe, expect, it } from 'vitest';
import { useApp } from '@tests/harness';
import { request } from '@tests/request';
import { seed } from '@tests/Seed';
import DockerContainer from '@/modules/docker/models/DockerContainer';
import Deployment from '@/modules/deployment/models/Deployment';
import { repositoryRoutes } from '@quantum/contracts/modules/repository/routes';
import { ContainerStatus, ContainerDesiredState } from '@quantum/contracts/modules/docker/domain';
import { DeploymentStatus } from '@quantum/contracts/modules/deployment/domain';

const ctx = useApp();

let user: Awaited<ReturnType<typeof seed.orgContext>>['user'];
let org: Awaited<ReturnType<typeof seed.orgContext>>['org'];
let repositoryId: number;

beforeEach(async () => {
    const context = await seed.orgContext();
    user = context.user;
    org = context.org;

    const created = await request(ctx.app, repositoryRoutes.create, {
        as: user.id,
        body: { name: 'MonteGordo', url: 'https://github.com/acme/monte-gordo', projectId: context.project.id }
    });
    repositoryId = created.data().id;
});

const container = (status: ContainerStatus) => DockerContainer.create({
    name: 'app',
    dockerContainerName: 'quantum-container-1',
    command: '/bin/sh',
    storagePath: '/var/lib/quantum/x',
    status,
    desiredState: ContainerDesiredState.Running,
    userId: user.id,
    organizationId: org.id,
    networkId: 1,
    imageId: 1,
    repositoryId,
    isRepositoryContainer: true
}).save();

const reported = async () => {
    const res = await request(ctx.app, repositoryRoutes.mine, { as: user.id });
    return res.data().find((entry) => entry.id === repositoryId)?.containerStatus ?? null;
};

describe('repository container status', () => {
    it('reports nothing before a container exists', async () => {
        expect(await reported()).toBeNull();
    });

    it('reports what the container row says, on both the list and the single read', async () => {
        await container(ContainerStatus.Running);

        expect(await reported()).toBe(ContainerStatus.Running);

        const single = await request(ctx.app, repositoryRoutes.get, { as: user.id, params: { id: repositoryId } });
        expect(single.data().containerStatus).toBe(ContainerStatus.Running);
    });

    it('does not contradict a successful deployment while the container runs', async () => {
        await container(ContainerStatus.Running);
        await Deployment.create({
            repositoryId,
            userId: user.id,
            organizationId: org.id,
            environmentId: null,
            githubDeploymentId: null,
            status: DeploymentStatus.Success,
            error: null,
            commit: null,
            artifact: null,
            url: null,
            environmentVariables: {}
        }).save();

        const latest = await Deployment.findOne({ where: { repositoryId }, order: { id: 'DESC' } });

        expect(latest?.status).toBe(DeploymentStatus.Success);
        expect(await reported()).toBe(ContainerStatus.Running);
    });

    it('follows the container row when it stops, with no second copy to update', async () => {
        const row = await container(ContainerStatus.Running);
        expect(await reported()).toBe(ContainerStatus.Running);

        row.status = ContainerStatus.Stopped;
        await row.save();

        expect(await reported()).toBe(ContainerStatus.Stopped);
    });
});
