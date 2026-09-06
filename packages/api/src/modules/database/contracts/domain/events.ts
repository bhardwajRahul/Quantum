export type ProvisionAction = 'create' | 'backup' | 'restore' | 'delete';

export interface DatabaseProvisionRequestedPayload{
    databaseId: number;
    action: ProvisionAction;
    userId: number;
    backupId?: string;
    containerId?: number | null;
}
