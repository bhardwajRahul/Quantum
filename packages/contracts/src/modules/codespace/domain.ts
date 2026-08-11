import type { BaseEntity } from '../../shared/base';

export enum CodespaceStatus{
    Pending = 'pending',
    Provisioning = 'provisioning',
    Running = 'running',
    Stopped = 'stopped',
    Error = 'error'
}

export enum PortBindingProtocol{
    Tcp = 'tcp',
    Udp = 'udp'
}

export interface Codespace extends BaseEntity{
    name: string;
    organizationId: number;
    projectId: number;
    userId: number;
    imageId: number | null;
    networkId: number | null;
    containerId: number | null;
    portBindingId: number | null;
    cpuCores: number;
    memoryMb: number;
    diskGb: number;
    status: CodespaceStatus;
    accessUrl: string | null;
    nodeId: string;
}

export interface CodespaceAccess{
    accessUrl: string;
    password: string;
}

export interface PortBinding extends BaseEntity{
    containerId: number;
    userId: number;
    organizationId: number;
    internalPort: number;
    externalPort: number;
    protocol: PortBindingProtocol;
}
