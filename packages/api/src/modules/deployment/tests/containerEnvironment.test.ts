import { describe, expect, it } from 'vitest';
import { useApp } from '@tests/harness';
import { seed } from '@tests/Seed';
import ContainerOptionsResolver from '@/modules/deployment/orchestrator/ContainerOptionsResolver';
import Deployment from '@/modules/deployment/models/Deployment';
import Repository from '@/modules/repository/models/Repository';
import DockerContainer from '@/modules/docker/models/DockerContainer';
import DockerImage from '@/modules/docker/models/DockerImage';
import DockerNetwork from '@/modules/docker/models/DockerNetwork';
import { DeploymentStatus } from '@quantum/contracts/modules/deployment/domain';
import { NetworkDriver } from '@quantum/contracts/modules/docker/domain';

useApp();

const infra = async () => {
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
    const container = await DockerContainer.create({
        name: 'shop-web', dockerContainerName: 'quantum-container-1', command: '/bin/sh',
        storagePath: '/var/lib/quantum/containers/1', userId: user.id, organizationId: org.id,
        networkId: network.id, imageId: image.id, repositoryId: repository.id, isRepositoryContainer: true,
        environmentVariables: { NODE_ENV: 'production' }, ipAddress: '10.9.0.4'
    }).save();

    return { repository, container, user, org };
};

const deployment = (repositoryId: number, userId: number, variables: Record<string, string>) => Deployment.create({
    repositoryId, userId, organizationId: null, githubDeploymentId: null, status: DeploymentStatus.Success,
    error: null, commit: null, artifact: null, url: null, environmentVariables: variables
}).save();

describe('container environment', () => {
    it('hands a repository container the variables of its latest deployment on create', async () => {
        const { repository, container, user } = await infra();
        await deployment(repository.id, user.id, { API_URL: 'http://old', PORT: '3000' });
        await deployment(repository.id, user.id, { API_URL: 'http://10.9.0.7:9000' });

        const options = await new ContainerOptionsResolver(container).resolve();

        expect(options.Env).toEqual(['NODE_ENV=production', 'API_URL=http://10.9.0.7:9000']);
    });
});
