import { describe, expect, it } from 'vitest';
import { useApp } from '@tests/harness';
import { seed } from '@tests/Seed';
import Repository from '@/modules/repository/models/Repository';
import DockerContainer from '@/modules/docker/models/DockerContainer';
import DockerImage from '@/modules/docker/models/DockerImage';
import DockerNetwork from '@/modules/docker/models/DockerNetwork';
import { withContainerStatus } from '@/modules/repository/services/withContainerStatus';
import { NetworkDriver } from '@quantum/contracts/modules/docker/domain';

useApp();

describe('repository address', () => {
    it('reports the internal address next to the container status', async () => {
        const { user, org, project } = await seed.orgContext();
        const repository = await Repository.create({
            name: 'Shop Web', alias: 'shop-web', owner: null, branch: 'main', webhookId: null,
            buildCommand: '', installCommand: '', startCommand: 'npm start', rootDirectory: '/',
            framework: null, runtime: 'node', runtimeVersion: null, outputDirectory: null,
            dockerfilePath: null, image: null, url: 'https://github.com/acme/shop-web', port: 3000,
            userId: user.id, organizationId: org.id, projectId: project.id
        }).save();
        const network = await DockerNetwork.create({
            name: 'shop-web', dockerNetworkName: 'quantum-network-7', subnet: '10.1.2.0/24',
            driver: NetworkDriver.Bridge, userId: user.id, organizationId: org.id
        }).save();
        const image = await DockerImage.create({ name: 'node', tag: '20', userId: user.id, organizationId: org.id }).save();
        await DockerContainer.create({
            name: 'shop-web', dockerContainerName: 'quantum-container-1', command: '/bin/sh',
            storagePath: '/var/lib/quantum/containers/1', userId: user.id, organizationId: org.id,
            networkId: network.id, imageId: image.id, repositoryId: repository.id, isRepositoryContainer: true,
            ipAddress: '10.9.0.4'
        }).save();

        const [payload] = await withContainerStatus([repository]);

        expect(payload.address).toEqual({ ip: '10.9.0.4', hostname: 'shop-web' });
    });
});
