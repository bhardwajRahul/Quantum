import type { DeploymentRequestedPayload, DeploymentRollbackRequestedPayload, RepositoryDeletedPayload } from '../domain/events';

declare global{
    interface EventMap{
        'deployment.requested': DeploymentRequestedPayload;
        'deployment.rollbackRequested': DeploymentRollbackRequestedPayload;
        'repository.deleted': RepositoryDeletedPayload;
    }
}
