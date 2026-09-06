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

export enum PortBindingProtocol{
    Tcp = 'tcp',
    Udp = 'udp'
}

export enum NetworkDriver{
    Bridge = 'bridge',
    Overlay = 'overlay',
    None = 'none'
}

export interface DockerContainerVolume{
    containerPath: string;
    mode: 'rw' | 'ro';
    source?: string;
}

export interface ContainerAddress{
    ip: string | null;
    hostname: string;
}

export interface PortBinding extends BaseEntity{
    containerId: number;
    userId: number;
    organizationId: number;
    internalPort: number;
    externalPort: number;
    protocol: PortBindingProtocol;
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
