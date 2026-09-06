import { describe, expect, it } from 'vitest';
import { useApp } from '@tests/harness';
import { request, expectError } from '@tests/request';
import { seed } from '@tests/Seed';
import { dockerRoutes } from '@quantum/contracts/modules/docker/routes';
import Metric from '../../metric/models/Metric';

const ctx = useApp();

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
