import type { CodespaceProvisionRequestedPayload } from '../domain/events';

declare global{
    interface EventMap{
        'codespace.provisionRequested': CodespaceProvisionRequestedPayload;
    }
}
