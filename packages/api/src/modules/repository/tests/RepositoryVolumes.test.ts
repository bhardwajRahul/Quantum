import { describe, expect, it, vi } from 'vitest';
import { useApp, flushEvents } from '@tests/harness';
import { request, expectError } from '@tests/request';
import { seed } from '@tests/Seed';
import { eventBus } from '@/shared/events/EventBus';
import ProvisionService from '@/modules/deployment/orchestrator/ProvisionService';
import ContainerOps from '@/modules/deployment/orchestrator/ContainerOps';
import Deployment from '@/modules/deployment/models/Deployment';
import Job from '@/modules/deployment/models/Job';
import JobRunner from '@/modules/deployment/orchestrator/JobRunner';
import { buildHandlerMap } from '@/modules/deployment/orchestrator/HandlerRegistry';
import DockerContainer from '@/modules/docker/models/DockerContainer';
import DockerImage from '@/modules/docker/models/DockerImage';
import DockerNetwork from '@/modules/docker/models/DockerNetwork';
import PortBinding from '@/modules/docker/models/PortBinding';
import Repository from '../models/Repository';
import { repositoryRoutes } from '@quantum/contracts/modules/repository/routes';
import { DeploymentStatus, JobType } from '@quantum/contracts/modules/deployment/domain';
import { NetworkDriver, PortBindingProtocol } from '@quantum/contracts/modules/docker/domain';
import type { OrgContext } from '@tests/Seed';
import type { DeploymentRequestedPayload } from '../contracts/domain/events';

vi.mock('@/modules/deployment/orchestrator/NetworkOps', async (importOriginal) => ({
    ...(await importOriginal<typeof import('@/modules/deployment/orchestrator/NetworkOps')>()),
    teardownNetwork: vi.fn(async () => undefined)
}));

const ctx = useApp();

const collect = <T>(event: keyof EventMap): T[] => {
    const received: T[] = [];
    eventBus.subscribe(event, (payload) => {
        received.push(payload as T);
    });
    return received;
};

const deployed = async ({ user, org, project }: OrgContext, volumes: string[] = []) => {
    const repository = await Repository.create({
        name: 'Shop', alias: 'shop', owner: null, branch: 'main', webhookId: null,
        buildCommand: '', installCommand: '', startCommand: 'npm start', rootDirectory: '/',
        framework: null, runtime: 'node', runtimeVersion: null, outputDirectory: null,
        dockerfilePath: null, image: null, url: 'https://github.com/acme/shop', port: 3000, volumes,
        userId: user.id, organizationId: org.id, projectId: project.id
    }).save();
    const network = await DockerNetwork.create({
        name: 'shop', dockerNetworkName: 'quantum-network-test-77', subnet: '10.7.7.0/24',
        driver: NetworkDriver.Bridge, userId: user.id, organizationId: org.id
    }).save();
    const image = await DockerImage.create({ name: 'node', tag: '20', userId: user.id, organizationId: org.id }).save();
    const container = await DockerContainer.create({
        name: 'shop', dockerContainerName: 'quantum-container-test-77', command: '/bin/sh',
        storagePath: '/var/lib/quantum/production/containers/1/github-repos/shop-77',
        userId: user.id, organizationId: org.id, networkId: network.id, imageId: image.id,
        repositoryId: repository.id, isRepositoryContainer: true
    }).save();
    await PortBinding.create({ containerId: container.id, userId: user.id, organizationId: org.id, internalPort: 3000, externalPort: 20077, protocol: PortBindingProtocol.Tcp }).save();
    return { repository, container, network };
};

describe('repository persistent volumes', () => {
    it('stores the volumes and asks for a redeploy so the container is recreated with them', async () => {
        const context = await seed.orgContext();
        const { repository } = await deployed(context);
        const requested = collect<DeploymentRequestedPayload>('deployment.requested');

        const res = await request(ctx.app, repositoryRoutes.update, {
            as: context.user.id, params: { id: repository.id }, body: { volumes: ['/var/lib/app/uploads/', '/data'] }
        });

        expect(res.status).toBe(200);
        expect(res.data().volumes).toEqual(['/var/lib/app/uploads', '/data']);
        await flushEvents();
        expect(requested.map((payload) => payload.repositoryId)).toEqual([repository.id]);
    });

    it('rejects a volume that is not an absolute container path', async () => {
        const context = await seed.orgContext();
        const { repository } = await deployed(context);

        const res = await request(ctx.app, repositoryRoutes.update, { as: context.user.id, params: { id: repository.id }, body: { volumes: ['data'] } });

        expectError(res, 400, 'Repository::InvalidVolume:data');
    });

    it('carries the repository volumes onto its container before each deploy', async () => {
        const context = await seed.orgContext();
        const { repository, container } = await deployed(context, ['/data']);

        const infra = await new ProvisionService().ensureRepositoryInfra(repository);

        expect(infra.id).toBe(container.id);
        expect((await DockerContainer.findOneByOrFail({ id: container.id })).volumes).toEqual([{ containerPath: '/data', mode: 'rw' }]);
    });

    it('tears the container, its volumes, ports, network and deployments down when the repository is deleted', async () => {
        const context = await seed.orgContext();
        const { repository, container, network } = await deployed(context, ['/data']);
        await Deployment.create({
            repositoryId: repository.id, userId: context.user.id, organizationId: context.org.id, githubDeploymentId: null,
            status: DeploymentStatus.Success, error: null, commit: null, artifact: null, url: null, environmentVariables: {}
        }).save();
        const removeContainer = vi.spyOn(ContainerOps.prototype, 'removeContainer').mockResolvedValue(undefined);

        const removed = await request(ctx.app, repositoryRoutes.remove, { as: context.user.id, params: { id: repository.id } });
        expect(removed.status).toBe(204);
        await flushEvents();

        const jobs = await Job.findBy({ type: JobType.RepositoryTeardown });
        expect(jobs.map((job) => job.repositoryId)).toEqual([repository.id]);
        await new JobRunner(buildHandlerMap()).processDue();

        expect(removeContainer).toHaveBeenCalledTimes(1);
        expect(await DockerContainer.findOneBy({ id: container.id })).toBeNull();
        expect(await PortBinding.countBy({ containerId: container.id })).toBe(0);
        expect(await DockerNetwork.findOneBy({ id: network.id })).toBeNull();
        expect(await Deployment.countBy({ repositoryId: repository.id })).toBe(0);
        removeContainer.mockRestore();
    });
});
