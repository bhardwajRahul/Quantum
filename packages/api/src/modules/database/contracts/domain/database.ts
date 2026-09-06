import type { DatabaseBackup, DatabaseEngine, DatabaseStatus } from '@quantum/contracts/modules/database/domain';

export interface DatabaseFields{
    name: string;
    engine: DatabaseEngine;
    version: string | null;
    organizationId: number;
    projectId: number;
    environmentId: number | null;
    userId: number | null;
    nodeId: string;
    status: DatabaseStatus;
    containerId: number | null;
    credentialsEnc: string | null;
    connectionStringEnc: string | null;
    backups: DatabaseBackup[];
    createdAt: Date;
    updatedAt: Date;
}
