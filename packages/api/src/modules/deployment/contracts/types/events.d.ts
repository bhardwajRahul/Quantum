import type { DeploymentCompletedPayload, DeploymentLogPayload, DeploymentStatusChangedPayload } from '../domain/events';

declare global{
    interface EventMap{
        'deployment.statusChanged': DeploymentStatusChangedPayload;
        'deployment.log': DeploymentLogPayload;
        'deployment.completed': DeploymentCompletedPayload;
    }
}
