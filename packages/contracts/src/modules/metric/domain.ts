import type { BaseEntity } from '../../shared/base';

export interface Metric extends BaseEntity{
    organizationId: number | null;
    containerId: number | null;
    repositoryId: number | null;
    projectId: number | null;
    environmentId: number | null;
    userId: number | null;
    nodeId: string;
    cpuPercent: number;
    memUsage: number;
    memLimit: number;
    memPercent: number;
    netRx: number;
    netTx: number;
    blkRead: number;
    blkWrite: number;
    pids: number;
    ts: string;
}
