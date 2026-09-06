import { describe, expect, it } from 'vitest';
import { useApp } from '@tests/harness';
import { request, expectError } from '@tests/request';
import { seed } from '@tests/Seed';
import { metricRoutes } from '@quantum/contracts/modules/metric/routes';
import { UserRole } from '@quantum/contracts/modules/user/domain';
import { DatabaseEngine } from '@quantum/contracts/modules/database/domain';
import Metric from '../models/Metric';
import DockerContainer from '@/modules/docker/models/DockerContainer';
import Repository from '@/modules/repository/models/Repository';
import Database from '@/modules/database/models/Database';
import TemplateInstall from '@/modules/template/models/TemplateInstall';
import Codespace from '@/modules/codespace/models/Codespace';
import type { DeepPartial } from 'typeorm';

const ctx = useApp();

let sequence = 0;

const seedContainer = async (organizationId: number, userId: number, attributes: DeepPartial<DockerContainer> = {}): Promise<DockerContainer> => {
    sequence += 1;
    return Object.assign(DockerContainer.create(), {
        name: `container-${sequence}`,
        dockerContainerName: '',
        command: null,
        userId,
        organizationId,
        networkId: 1,
        imageId: 1,
        isRepositoryContainer: false
    }, attributes).save();
};

const seedMetric = async (attributes: DeepPartial<Metric>): Promise<Metric> => {
    return Object.assign(Metric.create(), {
        cpuPercent: 12.5,
        memUsage: 1024,
        memLimit: 4096,
        memPercent: 25,
        netRx: 100,
        netTx: 50,
        blkRead: 0,
        blkWrite: 0,
        pids: 3,
        ts: new Date()
    }, attributes).save();
};

describe('metric containers', () => {
    it('rejects unauthenticated requests', async () => {
        expectError(await request(ctx.app, metricRoutes.containers), 401, 'Authentication::Unauthorized');
        expectError(await request(ctx.app, metricRoutes.byContainer, { params: { containerId: 1 } }), 401, 'Authentication::Unauthorized');
    });

    it('lists every container of the organization with the application it belongs to', async () => {
        const { user, org, project } = await seed.orgContext();
        const repository = await Repository.create({
            name: 'Shop', alias: 'shop', url: 'https://github.test/shop', userId: user.id, organizationId: org.id, projectId: project.id
        }).save();
        const repositoryContainer = await seedContainer(org.id, user.id, { repositoryId: repository.id, isRepositoryContainer: true });
        const databaseContainer = await seedContainer(org.id, user.id);
        await Database.create({
            name: 'main-db', engine: DatabaseEngine.Postgres, organizationId: org.id, projectId: project.id, userId: user.id,
            containerId: databaseContainer.id, backups: []
        }).save();
        const gateway = await seedContainer(org.id, user.id);
        const api = await seedContainer(org.id, user.id);
        await TemplateInstall.create({
            name: 'pollium', organizationId: org.id, projectId: project.id, userId: user.id,
            services: [
                { name: 'gateway', kind: 'app', image: 'ghcr.io/pollium/gateway:main', containerId: gateway.id, ports: [], address: null },
                { name: 'api', kind: 'app', image: 'ghcr.io/pollium/api:main', containerId: api.id, ports: [], address: null }
            ]
        }).save();
        const workspace = await seedContainer(org.id, user.id);
        await Codespace.create({ name: 'code-shop', organizationId: org.id, projectId: project.id, userId: user.id, containerId: workspace.id }).save();
        await seedContainer(org.id, user.id);
        const foreign = await seed.orgContext();
        await seedContainer(foreign.org.id, foreign.user.id);

        const res = await request(ctx.app, metricRoutes.containers, { as: user.id });

        expect(res.status).toBe(200);
        expect(res.data()).toEqual([
            { containerId: repositoryContainer.id, kind: 'repository', app: 'Shop', service: null },
            { containerId: databaseContainer.id, kind: 'database', app: 'main-db', service: null },
            { containerId: api.id, kind: 'stack', app: 'pollium', service: 'api' },
            { containerId: gateway.id, kind: 'stack', app: 'pollium', service: 'gateway' },
            { containerId: workspace.id, kind: 'workspace', app: 'code-shop', service: null }
        ]);
    });

    it('returns the samples of a container to a member of the owning organization', async () => {
        const { user, org } = await seed.orgContext();
        const container = await seedContainer(org.id, user.id);
        await seedMetric({ organizationId: org.id, containerId: container.id });
        await seedMetric({ organizationId: org.id, containerId: container.id });
        await seedMetric({ organizationId: org.id, containerId: container.id + 1000 });

        const res = await request(ctx.app, metricRoutes.byContainer, { as: user.id, params: { containerId: container.id } });

        expect(res.status).toBe(200);
        expect(res.data()).toHaveLength(2);
        for(const metric of res.data()){
            expect(metric.containerId).toBe(container.id);
            expect(metric.cpuPercent).toBe(12.5);
        }
    });

    it('forbids the samples of a foreign organization', async () => {
        const owner = await seed.orgContext();
        const outsider = await seed.orgContext();
        const container = await seedContainer(owner.org.id, owner.user.id);
        await seedMetric({ organizationId: owner.org.id, containerId: container.id });

        const res = await request(ctx.app, metricRoutes.byContainer, { as: outsider.user.id, params: { containerId: container.id } });

        expectError(res, 403, 'Metric::Forbidden');
    });

    it('answers 404 for an unknown container', async () => {
        const { user } = await seed.orgContext();

        const res = await request(ctx.app, metricRoutes.byContainer, { as: user.id, params: { containerId: 999999 } });

        expectError(res, 404, 'Metric::NotFound');
    });

    it('lets a platform admin read the samples of a foreign container', async () => {
        const owner = await seed.orgContext();
        const admin = await seed.user(UserRole.Admin);
        const container = await seedContainer(owner.org.id, owner.user.id);
        await seedMetric({ organizationId: owner.org.id, containerId: container.id });

        const res = await request(ctx.app, metricRoutes.byContainer, { as: admin.id, params: { containerId: container.id } });

        expect(res.status).toBe(200);
        expect(res.data()).toHaveLength(1);
    });

    it('applies the limit and minutes window', async () => {
        const { user, org } = await seed.orgContext();
        const container = await seedContainer(org.id, user.id);
        await seedMetric({ organizationId: org.id, containerId: container.id });
        await seedMetric({ organizationId: org.id, containerId: container.id });
        await seedMetric({ organizationId: org.id, containerId: container.id, ts: new Date(Date.now() - 120 * 60 * 1000) });

        const limited = await request(ctx.app, metricRoutes.byContainer, { as: user.id, params: { containerId: container.id }, query: { limit: 1 } });
        expect(limited.status).toBe(200);
        expect(limited.data()).toHaveLength(1);

        const windowed = await request(ctx.app, metricRoutes.byContainer, { as: user.id, params: { containerId: container.id }, query: { minutes: 60 } });
        expect(windowed.status).toBe(200);
        expect(windowed.data()).toHaveLength(2);
    });
});
