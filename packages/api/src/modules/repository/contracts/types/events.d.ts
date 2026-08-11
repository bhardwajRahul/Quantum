import type { DeploymentRequestedPayload, DeploymentRollbackRequestedPayload } from '../domain/events';

declare global{
    interface EventMap{
        'deployment.requested': DeploymentRequestedPayload;
        'deployment.rollbackRequested': DeploymentRollbackRequestedPayload;
    }
}
