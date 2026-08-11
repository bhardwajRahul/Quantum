import { describe, expect, it } from 'vitest';
import { useApp } from '@tests/harness';
import { request, expectError, route } from '@tests/request';
import { seed } from '@tests/Seed';
import { dockerRoutes } from '@quantum/contracts/modules/docker/routes';
import { ContainerOperation } from '@quantum/contracts/modules/docker/domain';
import { UserRole } from '@quantum/contracts/modules/user/domain';
import type { Endpoint } from '@quantum/contracts/shared/routing';
import DockerContainer from '../models/DockerContainer';
import DockerImage from '../models/DockerImage';
import DockerNetwork from '../models/DockerNetwork';
import Metric from '../../metric/models/Metric';

const ctx = useApp();

const seedContainer = async (userId: number, organizationId: number, name: string): Promise<DockerContainer> => {
    return DockerContainer.create({ name, userId, organizationId, networkId: 1, imageId: 1 }).save();
};

describe('docker admin', () => {
    it('rejects unauthenticated requests', async () => {
        const res = await request(ctx.app, dockerRoutes.containers);

        expectError(res, 401, 'Authentication::Unauthorized');
    });

    it('forbids regular users on admin routes', async () => {
        const { user } = await seed.orgContext();

        const adminEndpoints: Array<Endpoint<never, unknown>> = [
            dockerRoutes.containers,
            dockerRoutes.images,
            dockerRoutes.networks
        ];
        for(const endpoint of adminEndpoints){
            const res = await request(ctx.app, endpoint, { as: user.id });
            expectError(res, 403, 'Authentication::Forbidden');
        }

        const container = await seedContainer(user.id, 1, 'web');
        const get = await request(ctx.app, dockerRoutes.container, { as: user.id, params: { id: container.id } });
        expectError(get, 403, 'Authentication::Forbidden');

        const operate = await request(ctx.app, dockerRoutes.operate, {
            as: user.id,
            params: { id: container.id },
            body: { operation: ContainerOperation.Start }
        });
        expectError(operate, 403, 'Authentication::Forbidden');
    });

    it('lists containers, images and networks for a platform admin', async () => {
        const admin = await seed.user(UserRole.Admin);
        await seedContainer(admin.id, 1, 'web');
        await DockerImage.create({ name: 'nginx', tag: 'latest', userId: admin.id, organizationId: 1 }).save();
        await DockerNetwork.create({ name: 'edge', userId: admin.id, organizationId: 1 }).save();

        const containers = await request(ctx.app, dockerRoutes.containers, { as: admin.id });
        expect(containers.status).toBe(200);
        expect(containers.data()).toHaveLength(1);
        expect(containers.data()[0].name).toBe('web');
        expect(containers.data()[0].status).toBe('created');

        const images = await request(ctx.app, dockerRoutes.images, { as: admin.id });
        expect(images.status).toBe(200);
        expect(images.data()).toHaveLength(1);
        expect(images.data()[0]).toMatchObject({ name: 'nginx', tag: 'latest' });

        const networks = await request(ctx.app, dockerRoutes.networks, { as: admin.id });
        expect(networks.status).toBe(200);
        expect(networks.data()).toHaveLength(1);
        expect(networks.data()[0]).toMatchObject({ name: 'edge', driver: 'bridge' });
    });

    it('gets a container by id as a platform admin', async () => {
        const admin = await seed.user(UserRole.Admin);
        const container = await seedContainer(admin.id, 1, 'worker');

        const res = await request(ctx.app, dockerRoutes.container, { as: admin.id, params: { id: container.id } });

        expect(res.status).toBe(200);
        expect(res.data()).toMatchObject({ id: container.id, name: 'worker' });
    });

    it('answers 404 for an unknown container', async () => {
        const admin = await seed.user(UserRole.Admin);

        const res = await request(ctx.app, dockerRoutes.container, { as: admin.id, params: { id: 999999 } });

        expectError(res, 404, 'Docker::NotFound');
    });

    it('rejects an invalid operation body', async () => {
        const admin = await seed.user(UserRole.Admin);
        const container = await seedContainer(admin.id, 1, 'web');

        const res = await request(ctx.app, route('POST', dockerRoutes.operate.path), {
            as: admin.id,
            params: { id: container.id },
            body: { operation: 'explode' }
        });

        expectError(res, 400, 'Request::ValidationFailed');
    });

    it('answers 500 when the docker daemon does not know the container', async () => {
        const admin = await seed.user(UserRole.Admin);
        const container = await seedContainer(admin.id, 1, 'ghost');
        container.dockerContainerName = `quantum-test-missing-${Date.now()}`;
        await container.save();

        const res = await request(ctx.app, dockerRoutes.operate, {
            as: admin.id,
            params: { id: container.id },
            body: { operation: ContainerOperation.Start }
        });

        expectError(res, 500, 'Docker::OperationFailed');
    });
});

describe('docker usage', () => {
    it('aggregates network usage per project for the tenant', async () => {
        const { user, org, project } = await seed.orgContext();
        const base = { organizationId: org.id, projectId: project.id, containerId: 1 };
        await Metric.create({ ...base, netRx: 100, netTx: 50, ts: new Date() }).save();
        await Metric.create({ ...base, netRx: 400, netTx: 250, ts: new Date() }).save();

        const res = await request(ctx.app, dockerRoutes.networkUsage, { as: user.id });

        expect(res.status).toBe(200);
        expect(res.data()).toEqual([{
            projectId: project.id,
            projectName: project.name,
            incoming: 300,
            outgoing: 200
        }]);
    });

    it('aggregates resource usage per project for the tenant', async () => {
        const { user, org, project } = await seed.orgContext();
        const base = { organizationId: org.id, projectId: project.id, containerId: 1 };
        await Metric.create({ ...base, cpuPercent: 10, memPercent: 20, memUsage: 1024, ts: new Date() }).save();
        await Metric.create({ ...base, cpuPercent: 30, memPercent: 40, memUsage: 2048, ts: new Date() }).save();

        const res = await request(ctx.app, dockerRoutes.resourceUsage, { as: user.id });

        expect(res.status).toBe(200);
        expect(res.data()).toEqual([{
            projectId: project.id,
            projectName: project.name,
            avgCpu: 20,
            avgMem: 30,
            maxMem: 2048
        }]);
    });

    it('excludes metrics of foreign organizations', async () => {
        const { user, org, project } = await seed.orgContext();
        const foreign = await seed.orgContext();
        await Metric.create({
            organizationId: org.id,
            projectId: project.id,
            containerId: 1,
            cpuPercent: 10,
            ts: new Date()
        }).save();
        await Metric.create({
            organizationId: foreign.org.id,
            projectId: foreign.project.id,
            containerId: 2,
            cpuPercent: 99,
            ts: new Date()
        }).save();

        const network = await request(ctx.app, dockerRoutes.networkUsage, { as: user.id });
        expect(network.status).toBe(200);
        expect(network.data()).toHaveLength(1);
        expect(network.data()[0].projectId).toBe(project.id);

        const resources = await request(ctx.app, dockerRoutes.resourceUsage, { as: user.id });
        expect(resources.status).toBe(200);
        expect(resources.data()).toHaveLength(1);
        expect(resources.data()[0].projectId).toBe(project.id);
    });

    it('rejects unauthenticated usage requests', async () => {
        const res = await request(ctx.app, dockerRoutes.networkUsage);

        expectError(res, 401, 'Authentication::Unauthorized');
    });
});
