export interface CodespaceProvisionRequestedPayload{
    codespaceId: number;
    action: 'create' | 'delete';
    userId: number;
    containerId?: number | null;
    networkId?: number | null;
}
