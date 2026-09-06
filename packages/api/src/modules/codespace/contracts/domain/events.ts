export interface CodespaceProvisionRequestedPayload{
    codespaceId: number;
    action: 'create' | 'delete';
    userId: number;
    containerId?: number | null;
    networkId?: number | null;
}

export interface PortBindingChangedPayload{
    portBindingId: number;
    containerId: number;
    action: 'create' | 'delete';
}
