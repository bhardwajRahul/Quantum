export interface DeploymentRequestedPayload{
    repositoryId: number;
    reason: string;
    commit: string | null;
    userId: number | null;
}

export interface DeploymentRollbackRequestedPayload{
    repositoryId: number;
    deploymentId: number;
    userId: number;
}
