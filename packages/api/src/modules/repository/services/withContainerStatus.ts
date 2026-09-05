import { In } from 'typeorm';
import DockerContainer from '@/modules/docker/models/DockerContainer';
import PortBinding from '@/modules/codespace/models/PortBinding';
import type Repository from '../models/Repository';
import type { Repository as RepositoryPayload, RepositoryPort } from '@quantum/contracts/modules/repository/domain';

/**
 * Joins a repository to the runtime state of its container.
 *
 * The status is read here rather than mirrored onto the repository row. A stored copy
 * has to be written by whoever changes the container, and the moment one of those paths
 * throws halfway — as `ensureRepositoryInfra` did, saving the container row and then
 * failing before it could point the repository at it — the copy and the truth disagree
 * with no way to tell which is which.
 */
export const withContainerStatus = async (repositories: Repository[]): Promise<RepositoryPayload[]> => {
    if(repositories.length === 0) return [];

    const containers = await DockerContainer.find({
        where: { repositoryId: In(repositories.map((repository) => repository.id)) }
    });
    const statusByRepository = new Map(containers.map((container) => [container.repositoryId, container.status]));

    const bindings = containers.length === 0
        ? []
        : await PortBinding.find({ where: { containerId: In(containers.map((container) => container.id)) } });

    const portsByRepository = new Map<number, RepositoryPort[]>();
    for(const container of containers){
        // A container row can exist without a repository; only the ones with one matter.
        if(container.repositoryId === null) continue;
        portsByRepository.set(container.repositoryId, bindings
            .filter((binding) => binding.containerId === container.id)
            .map(({ internalPort, externalPort, protocol }) => ({ internalPort, externalPort, protocol })));
    }

    // Dates are serialised to strings on the way out, which is the only difference
    // between the entity and the payload.
    return repositories.map((repository) => ({
        ...repository,
        containerStatus: statusByRepository.get(repository.id) ?? null,
        ports: portsByRepository.get(repository.id) ?? []
    }) as unknown as RepositoryPayload);
};

export const oneWithContainerStatus = async (repository: Repository): Promise<RepositoryPayload> => {
    const [payload] = await withContainerStatus([repository]);
    return payload;
};
