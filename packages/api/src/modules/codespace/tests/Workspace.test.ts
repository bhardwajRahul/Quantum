import { describe, expect, it, vi } from 'vitest';
import { useApp, flushEvents } from '@tests/harness';
import { request, expectError } from '@tests/request';
import { seed } from '@tests/Seed';
import { eventBus } from '@/shared/events/EventBus';
import ContainerOps from '@/modules/deployment/orchestrator/ContainerOps';
import Repository from '@/modules/repository/models/Repository';
import DockerContainer from '@/modules/docker/models/DockerContainer';
import DockerImage from '@/modules/docker/models/DockerImage';
import DockerNetwork from '@/modules/docker/models/DockerNetwork';
import TemplateInstall from '@/modules/template/models/TemplateInstall';
import Job from '@/modules/deployment/models/Job';
import Codespace from '../models/Codespace';
import { codespaceRoutes } from '@quantum/contracts/modules/codespace/routes';
import { repositoryRoutes } from '@quantum/contracts/modules/repository/routes';
import { CodespaceStatus } from '@quantum/contracts/modules/codespace/domain';
import { ContainerDesiredState, NetworkDriver } from '@quantum/contracts/modules/docker/domain';
import { JobType } from '@quantum/contracts/modules/deployment/domain';
import { TemplateInstallStatus } from '@quantum/contracts/modules/template/domain';
import type { OrgContext } from '@tests/Seed';
import type { CodespaceProvisionRequestedPayload } from '../contracts/domain/events';

const ctx = useApp();

const collect = <T>(event: keyof EventMap): T[] => {
    const received: T[] = [];
    eventBus.subscribe(event, (payload) => {
        received.push(payload as T);
    });
    return received;
};

const repositoryOf = async ({ user, org, project }: OrgContext, deployed: boolean) => {
    const repository = await Repository.create({
        name: 'Shop', alias: 'shop', owner: null, branch: 'main', webhookId: null,
        buildCommand: '', installCommand: '', startCommand: 'npm start', rootDirectory: '/',
        framework: null, runtime: 'node', runtimeVersion: null, outputDirectory: null,
        dockerfilePath: null, image: null, url: 'https://github.com/acme/shop', port: 3000,
        userId: user.id, organizationId: org.id, projectId: project.id
    }).save();
    if(!deployed) return repository;

    const network = await DockerNetwork.create({
        name: 'shop', dockerNetworkName: 'quantum-network-3', subnet: '10.1.3.0/24',
        driver: NetworkDriver.Bridge, userId: user.id, organizationId: org.id
    }).save();
    const image = await DockerImage.create({ name: 'node', tag: '20', userId: user.id, organizationId: org.id }).save();
    await DockerContainer.create({
        name: 'shop', dockerContainerName: 'quantum-container-3', command: '/bin/sh',
        storagePath: '/var/lib/quantum/production/containers/1/github-repos/shop-3',
        userId: user.id, organizationId: org.id, networkId: network.id, imageId: image.id,
        repositoryId: repository.id, isRepositoryContainer: true
    }).save();
    return repository;
};

describe('per-application workspaces', () => {
    it('answers 404 until a workspace is opened and refuses to open one for an undeployed repository', async () => {
        const context = await seed.orgContext();
        const repository = await repositoryOf(context, false);

        const none = await request(ctx.app, codespaceRoutes.forRepository, { as: context.user.id, params: { repositoryId: repository.id } });
        expectError(none, 404, 'Codespace::NotFound');

        const refused = await request(ctx.app, codespaceRoutes.openForRepository, { as: context.user.id, params: { repositoryId: repository.id } });
        expectError(refused, 409, 'Codespace::TargetNotReady');
    });

    it('opens one workspace per repository, provisions it once and queues the job', async () => {
        const context = await seed.orgContext();
        const repository = await repositoryOf(context, true);
        const requested = collect<CodespaceProvisionRequestedPayload>('codespace.provisionRequested');

        const opened = await request(ctx.app, codespaceRoutes.openForRepository, { as: context.user.id, params: { repositoryId: repository.id } });
        expect(opened.status).toBe(200);
        expect(opened.data()).toMatchObject({
            name: 'code-shop', repositoryId: repository.id, templateInstallId: null,
            projectId: context.project.id, organizationId: context.org.id, status: CodespaceStatus.Pending
        });

        const again = await request(ctx.app, codespaceRoutes.openForRepository, { as: context.user.id, params: { repositoryId: repository.id } });
        expect(again.data().id).toBe(opened.data().id);
        expect(await Codespace.countBy({ repositoryId: repository.id })).toBe(1);

        const found = await request(ctx.app, codespaceRoutes.forRepository, { as: context.user.id, params: { repositoryId: repository.id } });
        expect(found.data().id).toBe(opened.data().id);

        await flushEvents();
        expect(requested).toEqual([{ codespaceId: opened.data().id, action: 'create', userId: context.user.id }]);
        const jobs = await Job.findBy({ type: JobType.CodespaceProvision });
        expect(jobs.map((job) => job.payload)).toEqual([{ codespaceId: opened.data().id }]);
    });

    it('keeps a stranger out of a repository workspace', async () => {
        const context = await seed.orgContext();
        const repository = await repositoryOf(context, true);
        const outsider = await seed.orgContext();

        const res = await request(ctx.app, codespaceRoutes.openForRepository, { as: outsider.user.id, params: { repositoryId: repository.id } });

        expect([403, 404]).toContain(res.status);
        expect(await Codespace.countBy({ repositoryId: repository.id })).toBe(0);
    });

    it('opens a workspace over the volumes of a running stack', async () => {
        const { user, org, project } = await seed.orgContext();
        const install = await TemplateInstall.create({
            templateId: null, compose: 'services:\n  api:\n    image: nginx\n', spec: { services: { api: { image: 'nginx' } } },
            name: 'stack', organizationId: org.id, projectId: project.id, userId: user.id, nodeId: 'local',
            inputsEnc: null, environment: {}, status: TemplateInstallStatus.Running,
            services: [{ name: 'api', kind: 'app', image: 'nginx', containerId: 41, ports: [], address: null }]
        }).save();

        const res = await request(ctx.app, codespaceRoutes.openForInstall, { as: user.id, params: { installId: install.id } });

        expect(res.status).toBe(200);
        expect(res.data()).toMatchObject({ name: `code-install-${install.id}`, templateInstallId: install.id, repositoryId: null });
    });

    it('stops the workspace container and remembers that it should stay down', async () => {
        const context = await seed.orgContext();
        const repository = await repositoryOf(context, true);
        const opened = await request(ctx.app, codespaceRoutes.openForRepository, { as: context.user.id, params: { repositoryId: repository.id } });
        const image = await DockerImage.findOneByOrFail({ name: 'node' });
        const network = await DockerNetwork.findOneByOrFail({ name: 'shop' });
        const container = await DockerContainer.create({
            name: 'code-shop', dockerContainerName: 'quantum-container-9', command: '', userId: context.user.id,
            organizationId: context.org.id, networkId: network.id, imageId: image.id, isRepositoryContainer: false
        }).save();
        await Codespace.update({ id: opened.data().id }, { containerId: container.id, status: CodespaceStatus.Running });
        const stop = vi.spyOn(ContainerOps.prototype, 'stop').mockResolvedValue(undefined);

        const res = await request(ctx.app, codespaceRoutes.stop, { as: context.user.id, params: { id: opened.data().id } });

        expect(res.status).toBe(200);
        expect(res.data().status).toBe(CodespaceStatus.Stopped);
        expect(stop).toHaveBeenCalledTimes(1);
        expect((await DockerContainer.findOneByOrFail({ id: container.id })).desiredState).toBe(ContainerDesiredState.Stopped);
        stop.mockRestore();
    });

    it('takes the workspace down with its repository', async () => {
        const context = await seed.orgContext();
        const repository = await repositoryOf(context, true);
        const opened = await request(ctx.app, codespaceRoutes.openForRepository, { as: context.user.id, params: { repositoryId: repository.id } });
        await flushEvents();
        const requested = collect<CodespaceProvisionRequestedPayload>('codespace.provisionRequested');

        const removed = await request(ctx.app, repositoryRoutes.remove, { as: context.user.id, params: { id: repository.id } });
        expect(removed.status).toBe(204);
        await flushEvents();

        expect(await Codespace.findOneBy({ id: opened.data().id })).toBeNull();
        expect(requested).toEqual([{ codespaceId: opened.data().id, action: 'delete', userId: context.user.id, containerId: null, networkId: null }]);
        const jobs = await Job.findBy({ type: JobType.CodespaceDelete });
        expect(jobs.map((job) => job.payload)).toEqual([{ codespaceId: opened.data().id, containerId: null, networkId: null }]);
    });
});
