import slugify from 'slugify';
import { In } from 'typeorm';
import DockerContainer from '../models/DockerContainer';
import type { ContainerAddress } from '@quantum/contracts/modules/docker/domain';

export const internalHostname = (container: Pick<DockerContainer, 'name'>): string =>
    slugify(container.name, { lower: true, strict: true });

export const containerAddress = (container: DockerContainer): ContainerAddress => ({
    ip: container.ipAddress === '' ? null : container.ipAddress,
    hostname: internalHostname(container)
});

export const containerAddresses = async (ids: Array<number | null>): Promise<Map<number, ContainerAddress>> => {
    const wanted = ids.filter((id): id is number => id !== null);
    if(wanted.length === 0) return new Map();

    const containers = await DockerContainer.findBy({ id: In(wanted) });
    return new Map(containers.map((container) => [container.id, containerAddress(container)]));
};
