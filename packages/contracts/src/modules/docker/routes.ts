import { get, post } from '../../shared/routing';
import type { ContainerOperationInput } from './http';
import type { DockerContainer, DockerImage, DockerNetwork, NetworkUsageStat, ResourceUsageStat } from './domain';

export const dockerRoutes = {
    containers: get<DockerContainer[]>('/docker/container'),
    container: get<DockerContainer>('/docker/container/:id'),
    operate: post<ContainerOperationInput, DockerContainer>('/docker/container/:id/operation'),
    images: get<DockerImage[]>('/docker/image'),
    networks: get<DockerNetwork[]>('/docker/network'),
    networkUsage: get<NetworkUsageStat[]>('/docker/usage/network'),
    resourceUsage: get<ResourceUsageStat[]>('/docker/usage/resources')
};
