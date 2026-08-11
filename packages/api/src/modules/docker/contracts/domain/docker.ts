import { ContainerDesiredState, ContainerStatus, NetworkDriver } from '@quantum/contracts/modules/docker/domain';
import type { DockerContainerVolume } from '@quantum/contracts/modules/docker/domain';

export interface DockerContainerFields{
    name: string;
    dockerContainerName: string;
    status: ContainerStatus;
    desiredState: ContainerDesiredState;
    command: string | null;
    ipAddress: string;
    isUserContainer: boolean;
    isRepositoryContainer: boolean;
    storagePath: string | null;
    startedAt: Date | null;
    stoppedAt: Date | null;
    volumes: DockerContainerVolume[];
    environmentVariables: Record<string, string>;
    userId: number;
    organizationId: number;
    networkId: number;
    imageId: number;
    repositoryId: number | null;
    createdAt: Date;
    updatedAt: Date;
}

export interface DockerImageFields{
    name: string;
    tag: string;
    size: number;
    userId: number;
    organizationId: number;
    createdAt: Date;
    updatedAt: Date;
}

export interface DockerNetworkFields{
    name: string;
    dockerNetworkName: string;
    subnet: string;
    driver: NetworkDriver;
    userId: number;
    organizationId: number;
    createdAt: Date;
    updatedAt: Date;
}
