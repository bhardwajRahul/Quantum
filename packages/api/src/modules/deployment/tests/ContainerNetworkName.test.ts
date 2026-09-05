import { describe, expect, it } from 'vitest';
import { useApp } from '@tests/harness';
import { seed } from '@tests/Seed';
import ContainerOptionsResolver from '@/modules/deployment/orchestrator/ContainerOptionsResolver';
import DockerContainer from '@/modules/docker/models/DockerContainer';
import DockerImage from '@/modules/docker/models/DockerImage';
import DockerNetwork from '@/modules/docker/models/DockerNetwork';
import { NetworkDriver } from '@quantum/contracts/modules/docker/domain';

useApp();

const infra = async (dockerNetworkName: string) => {
    const { user, org } = await seed.orgContext();

    const network = await DockerNetwork.create({
        name: 'net',
        dockerNetworkName,
        subnet: '10.1.2.0/24',
        driver: NetworkDriver.Bridge,
        userId: user.id,
        organizationId: org.id
    }).save();

    const image = await DockerImage.create({
        name: 'node',
        tag: '20',
        userId: user.id,
        organizationId: org.id
    }).save();

    const container = await DockerContainer.create({
        name: 'app',
        dockerContainerName: 'quantum-container-1',
        command: '/bin/sh',
        storagePath: '/var/lib/quantum/containers/1',
        userId: user.id,
        organizationId: org.id,
        networkId: network.id,
        imageId: image.id,
        isRepositoryContainer: true
    }).save();

    return { container, network };
};

describe('container network name', () => {
    /**
     * The regression: the attach used a name recomposed from ids
     * (`quantum-network-<env>-<userId>-<networkId>`) while `materializeNetwork` had
     * created `network.dockerNetworkName`. Docker only reported the mismatch as a 404 at
     * container-create time, so provisioning looked like it had succeeded.
     */
    it('attaches to the name the network was materialized under', async () => {
        const { container } = await infra('quantum-network-42');

        const options = await new ContainerOptionsResolver(container).resolve();

        expect(options.HostConfig?.NetworkMode).toBe('quantum-network-42');
    });

    it('refuses a network row that was never materialized, instead of guessing a name', async () => {
        const { container } = await infra('');

        await expect(new ContainerOptionsResolver(container).resolve())
            .rejects.toThrow('Container::Network::NotMaterialized');
    });
});
