import type { BaseEntity } from '../../shared/base';

export enum ContainerStatus{
    Created = 'created',
    Running = 'running',
    Stopped = 'stopped',
    Reloading = 'reloading',
    Restarting = 'restarting',
    Building = 'building',
    Error = 'error'
}

export enum ContainerDesiredState{
    Running = 'running',
    Stopped = 'stopped'
}

export enum ContainerOperation{
    Start = 'start',
    Stop = 'stop',
    Restart = 'restart'
}

export enum NetworkDriver{
    Bridge = 'bridge',
    Overlay = 'overlay',
    None = 'none'
}

export interface DockerContainerVolume{
    containerPath: string;
    mode: 'rw' | 'ro';
}

export interface DockerContainer extends BaseEntity{
    name: string;
    dockerContainerName: string;
    status: ContainerStatus;
    desiredState: ContainerDesiredState;
    command: string | null;
    ipAddress: string;
    isUserContainer: boolean;
    isRepositoryContainer: boolean;
    storagePath: string | null;
    startedAt: string | null;
    stoppedAt: string | null;
    volumes: DockerContainerVolume[];
    environmentVariables: Record<string, string>;
    userId: number;
    organizationId: number;
    networkId: number;
    imageId: number;
    repositoryId: number | null;
}

export interface DockerImage extends BaseEntity{
    name: string;
    tag: string;
    size: number;
    userId: number;
    organizationId: number;
}

export interface DockerNetwork extends BaseEntity{
    name: string;
    dockerNetworkName: string;
    subnet: string;
    driver: NetworkDriver;
    userId: number;
    organizationId: number;
}

export interface NetworkUsageStat{
    projectId: number;
    projectName: string;
    incoming: number;
    outgoing: number;
}

export interface ResourceUsageStat{
    projectId: number;
    projectName: string;
    avgCpu: number;
    avgMem: number;
    maxMem: number;
}
