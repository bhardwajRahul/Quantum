import type { BaseEntity } from '../../shared/base';

export enum DeploymentStatus{
    Pending = 'pending',
    Queued = 'queued',
    Building = 'building',
    Success = 'success',
    Failure = 'failure',
    Stopped = 'stopped',
    Rolledback = 'rolledback'
}

export enum JobStatus{
    Queued = 'queued',
    Active = 'active',
    Completed = 'completed',
    Failed = 'failed',
    Delayed = 'delayed',
    Canceled = 'canceled'
}

export enum JobType{
    Deploy = 'deploy',
    Redeploy = 'redeploy',
    Start = 'start',
    Stop = 'stop',
    Restart = 'restart',
    Reconcile = 'reconcile',
    Reload = 'reload',
    Build = 'build',
    DbProvision = 'db:provision',
    DbBackup = 'db:backup',
    DbRestore = 'db:restore',
    DbDelete = 'db:delete',
    MetricsSample = 'metrics:sample',
    HealthCheck = 'health:check',
    TemplateInstall = 'template:install',
    TemplateUninstall = 'template:uninstall',
    OrgCascadeDelete = 'org:cascade-delete',
    ProjectCascadeDelete = 'project:cascade-delete',
    AnalyticsSample = 'analytics:sample'
}

export interface DeploymentCommitAuthor{
    name: string;
    email: string;
}

export interface DeploymentCommit{
    message: string;
    author: DeploymentCommitAuthor;
    date: string;
}

export interface DeploymentArtifact{
    image: string;
    tag: string;
    digest: string;
    builder: string;
    sizeBytes: number;
}

export interface Deployment extends BaseEntity{
    repositoryId: number;
    userId: number;
    organizationId: number | null;
    environmentId: number | null;
    githubDeploymentId: string | null;
    status: DeploymentStatus;
    error: string | null;
    commit: DeploymentCommit | null;
    artifact: DeploymentArtifact | null;
    url: string | null;
    environmentVariables: Record<string, string>;
}

export interface DeploymentStatusFrame{
    deploymentId: number;
    status: DeploymentStatus;
}

export interface DeploymentLogFrame{
    deploymentId: number;
    line: string;
}

export interface DeploymentAccepted{
    jobId: number;
    status: JobStatus;
    action: string;
}

export interface DeploymentEnvironment{
    deploymentId: number;
    environmentVariables: Record<string, string>;
}
