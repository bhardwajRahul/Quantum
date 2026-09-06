import type { CodespaceStatus } from '@quantum/contracts/modules/codespace/domain';

export interface CodespaceFields{
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
    passwordEnc: string | null;
    nodeId: string;
    createdAt: Date;
    updatedAt: Date;
}
