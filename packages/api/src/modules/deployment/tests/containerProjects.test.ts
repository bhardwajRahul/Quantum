import { describe, expect, it } from 'vitest';
import { useApp } from '@tests/harness';
import { seed } from '@tests/Seed';
import { DatabaseEngine } from '@quantum/contracts/modules/database/domain';
import DockerContainer from '@/modules/docker/models/DockerContainer';
import Repository from '@/modules/repository/models/Repository';
import Database from '@/modules/database/models/Database';
import TemplateInstall from '@/modules/template/models/TemplateInstall';
import Codespace from '@/modules/codespace/models/Codespace';
import Metric from '@/modules/metric/models/Metric';
import { backfillContainerProjects } from '../orchestrator/containerProjects';

useApp();

let sequence = 0;

const seedContainer = async (organizationId: number, userId: number, repositoryId: number | null = null): Promise<DockerContainer> => {
    sequence += 1;
    return DockerContainer.create({
        name: `legacy-${sequence}`, dockerContainerName: '', command: null, userId, organizationId,
        networkId: 1, imageId: 1, isRepositoryContainer: repositoryId !== null, repositoryId, projectId: null
    }).save();
};

const projectOf = async (container: DockerContainer): Promise<number | null> =>
    (await DockerContainer.findOneByOrFail({ id: container.id })).projectId;

describe('container project backfill', () => {
    it('fills the project of every owned container and of its samples, and leaves orphans alone', async () => {
        const { user, org, project } = await seed.orgContext();
        const repository = await Repository.create({
            name: 'shop', alias: 'shop', url: 'https://github.test/shop', userId: user.id, organizationId: org.id, projectId: project.id
        }).save();
        const fromRepository = await seedContainer(org.id, user.id, repository.id);
        const fromDatabase = await seedContainer(org.id, user.id);
        await Database.create({
            name: 'db', engine: DatabaseEngine.Redis, organizationId: org.id, projectId: project.id, userId: user.id,
            containerId: fromDatabase.id, backups: []
        }).save();
        const fromInstall = await seedContainer(org.id, user.id);
        await TemplateInstall.create({
            name: 'stack', organizationId: org.id, projectId: project.id, userId: user.id,
            services: [{ name: 'web', kind: 'app', image: 'nginx', containerId: fromInstall.id, ports: [], address: null }]
        }).save();
        const fromCodespace = await seedContainer(org.id, user.id);
        await Codespace.create({ name: 'code', organizationId: org.id, projectId: project.id, userId: user.id, containerId: fromCodespace.id }).save();
        const orphan = await seedContainer(org.id, user.id);
        const sample = await Object.assign(Metric.create(), {
            organizationId: org.id, containerId: fromInstall.id, projectId: null,
            cpuPercent: 1, memUsage: 1, memLimit: 2, memPercent: 50, netRx: 0, netTx: 0, blkRead: 0, blkWrite: 0, pids: 1, ts: new Date()
        }).save();

        const updated = await backfillContainerProjects();

        expect(updated).toBeGreaterThanOrEqual(5);
        expect(await projectOf(fromRepository)).toBe(project.id);
        expect(await projectOf(fromDatabase)).toBe(project.id);
        expect(await projectOf(fromInstall)).toBe(project.id);
        expect(await projectOf(fromCodespace)).toBe(project.id);
        expect(await projectOf(orphan)).toBeNull();
        expect((await Metric.findOneByOrFail({ id: sample.id })).projectId).toBe(project.id);

        expect(await backfillContainerProjects()).toBe(0);
    });
});
