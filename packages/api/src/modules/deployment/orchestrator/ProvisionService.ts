import Repository from '@/modules/repository/models/Repository';
import DockerContainer from '@/modules/docker/models/DockerContainer';
import DockerImage from '@/modules/docker/models/DockerImage';
import DockerNetwork from '@/modules/docker/models/DockerNetwork';
import { getRuntimeImage } from './RuntimeRegistry';
import { getSystemDockerName, getContainerStoragePath } from './paths';
import { materializeNetwork } from './NetworkOps';
import ContainerOps from './ContainerOps';
import { NetworkDriver } from '@quantum/contracts/modules/docker/domain';
import { logger } from '@/shared/utils/Logger';

export default class ProvisionService{
    async ensureRepositoryInfra(repository: Repository): Promise<DockerContainer>{
        const existing = await DockerContainer.findOneBy({ repositoryId: repository.id });
        if(existing) return existing;

        const organizationId = repository.organizationId ?? 0;
        const image = await this.#ensureImage(repository, organizationId);
        const network = await this.#ensureNetwork(repository, organizationId);
        const container = await this.#createContainerRow(repository, organizationId, image.id, network.id);
        await this.#materialize(container);

        repository.containerId = container.id;
        await repository.save();
        return container;
    }

    async #ensureImage(repository: Repository, organizationId: number): Promise<DockerImage>{
        const { name, tag } = getRuntimeImage(repository.runtime, repository.runtimeVersion);
        const existing = await DockerImage.findOneBy({ name, tag, organizationId, userId: repository.userId });
        if(existing) return existing;
        return DockerImage.create({ name, tag, userId: repository.userId, organizationId }).save();
    }

    async #ensureNetwork(repository: Repository, organizationId: number): Promise<DockerNetwork>{
        const network = await DockerNetwork.create({
            name: repository.alias,
            dockerNetworkName: '',
            driver: NetworkDriver.Bridge,
            userId: repository.userId,
            organizationId
        }).save();
        network.dockerNetworkName = `quantum-network-${network.id}`;
        await network.save();
        await materializeNetwork(network);
        return network;
    }

    async #createContainerRow(repository: Repository, organizationId: number, imageId: number, networkId: number): Promise<DockerContainer>{
        const container = await DockerContainer.create({
            name: repository.alias,
            dockerContainerName: '',
            command: '/bin/sh',
            userId: repository.userId,
            organizationId,
            networkId,
            imageId,
            repositoryId: repository.id,
            isRepositoryContainer: true
        }).save();
        container.dockerContainerName = getSystemDockerName(container.id);
        container.storagePath = getContainerStoragePath(repository.userId, container.id, repository.alias).repositoryContainerPath;
        await container.save();
        return container;
    }

    async #materialize(container: DockerContainer): Promise<void>{
        try{
            await new ContainerOps(container).createAndStartContainer();
        }catch(error){
            logger.error(`failed materializing container ${container.dockerContainerName}`, error, { scope: 'orchestrator.provision' });
            throw error;
        }
    }
}
