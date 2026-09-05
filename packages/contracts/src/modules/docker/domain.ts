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
