import type { BaseEntity } from '../../shared/base';

export enum CodespaceStatus{
    Pending = 'pending',
    Provisioning = 'provisioning',
    Running = 'running',
    Stopped = 'stopped',
    Error = 'error'
}

export interface Codespace extends BaseEntity{
    name: string;
    organizationId: number;
    projectId: number;
    userId: number;
    repositoryId: number | null;
    templateInstallId: number | null;
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
