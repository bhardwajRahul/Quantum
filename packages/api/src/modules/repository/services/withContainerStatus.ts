import { In } from 'typeorm';
import DockerContainer from '@/modules/docker/models/DockerContainer';
import PortBinding from '@/modules/docker/models/PortBinding';
import { containerAddress } from '@/modules/docker/services/containerAddress';
import type Repository from '../models/Repository';
import type { Repository as RepositoryPayload, RepositoryPort } from '@quantum/contracts/modules/repository/domain';

export const withContainerStatus = async (repositories: Repository[]): Promise<RepositoryPayload[]> => {
    if(repositories.length === 0) return [];

    const containers = await DockerContainer.find({
        where: { repositoryId: In(repositories.map((repository) => repository.id)) }
    });
    const statusByRepository = new Map(containers.map((container) => [container.repositoryId, container.status]));
    const addressByRepository = new Map(containers.map((container) => [container.repositoryId, containerAddress(container)]));

    const bindings = containers.length === 0
        ? []
        : await PortBinding.find({ where: { containerId: In(containers.map((container) => container.id)) } });

    const portsByRepository = new Map<number, RepositoryPort[]>();
    for(const container of containers){
        if(container.repositoryId === null) continue;
        portsByRepository.set(container.repositoryId, bindings
            .filter((binding) => binding.containerId === container.id)
            .map(({ internalPort, externalPort, protocol }) => ({ internalPort, externalPort, protocol })));
    }

    return repositories.map((repository) => ({
        ...repository,
        containerStatus: statusByRepository.get(repository.id) ?? null,
        ports: portsByRepository.get(repository.id) ?? [],
        address: addressByRepository.get(repository.id) ?? null
    }) as unknown as RepositoryPayload);
};

export const oneWithContainerStatus = async (repository: Repository): Promise<RepositoryPayload> => {
    const [payload] = await withContainerStatus([repository]);
    return payload;
};
