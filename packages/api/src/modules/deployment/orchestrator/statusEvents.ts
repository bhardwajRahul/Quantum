import { eventBus } from '@/shared/events/EventBus';
import type { DeploymentStatus } from '@quantum/contracts/modules/deployment/domain';

export const emitStatusChanged = (deploymentId: number, repositoryId: number, status: DeploymentStatus): void => {
    eventBus.emit('deployment.statusChanged', { deploymentId, repositoryId, status });
};

export const emitCompleted = (deploymentId: number, repositoryId: number, status: DeploymentStatus): void => {
    eventBus.emit('deployment.completed', { deploymentId, repositoryId, status });
};
