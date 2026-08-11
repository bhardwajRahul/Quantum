export interface CodespaceProvisionRequestedPayload{
    codespaceId: number;
    action: 'create' | 'delete';
    userId: number;
}

export interface PortBindingChangedPayload{
    portBindingId: number;
    containerId: number;
    action: 'create' | 'delete';
}
