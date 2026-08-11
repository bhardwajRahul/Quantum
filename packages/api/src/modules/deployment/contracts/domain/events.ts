import type { DeploymentStatus } from '@quantum/contracts/modules/deployment/domain';

export interface DeploymentStatusChangedPayload{
    deploymentId: number;
    repositoryId: number;
    status: DeploymentStatus;
}

export interface DeploymentLogPayload{
    deploymentId: number;
    repositoryId: number;
    line: string;
}

export interface DeploymentCompletedPayload{
    deploymentId: number;
    repositoryId: number;
    status: DeploymentStatus;
}
