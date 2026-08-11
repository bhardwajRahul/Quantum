import type { CodespaceProvisionRequestedPayload, PortBindingChangedPayload } from '../domain/events';

declare global{
    interface EventMap{
        'codespace.provisionRequested': CodespaceProvisionRequestedPayload;
        'portBinding.changed': PortBindingChangedPayload;
    }
}
