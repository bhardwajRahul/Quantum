import type { DeploymentArtifact, DeploymentCommit, DeploymentStatus, JobStatus, JobType } from '@quantum/contracts/modules/deployment/domain';

export interface DeploymentFields{
    repositoryId: number;
    userId: number;
    organizationId: number | null;
    githubDeploymentId: string | null;
    status: DeploymentStatus;
    commit: DeploymentCommit | null;
    artifact: DeploymentArtifact | null;
    url: string | null;
    environmentVariables: Record<string, string>;
    createdAt: Date;
    updatedAt: Date;
}

export interface JobFields{
    type: JobType;
    status: JobStatus;
    nodeId: string;
    repositoryId: number | null;
    userId: number | null;
    containerId: number | null;
    deploymentId: number | null;
    projectId: number | null;
    organizationId: number | null;
    templateInstallId: number | null;
    payload: Record<string, unknown>;
    priority: number;
    attempts: number;
    maxAttempts: number;
    backoffMs: number;
    runAt: Date | null;
    lockedUntil: Date | null;
    claimedBy: string | null;
    idempotencyKey: string | null;
    lockKey: string | null;
    error: string | null;
    result: Record<string, unknown> | null;
    createdAt: Date;
    updatedAt: Date;
}
