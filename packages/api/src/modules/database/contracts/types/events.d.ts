import type { DatabaseProvisionRequestedPayload } from '../domain/events';

declare global{
    interface EventMap{
        'database.provisionRequested': DatabaseProvisionRequestedPayload;
    }
}
