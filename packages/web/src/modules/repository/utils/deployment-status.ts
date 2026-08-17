import { DeploymentStatus } from '@quantum/contracts/modules/deployment/domain';

const STATUS_COLORS: Record<DeploymentStatus, string> = {
    [DeploymentStatus.Pending]: 'text-warning',
    [DeploymentStatus.Queued]: 'text-warning',
    [DeploymentStatus.Building]: 'text-warning',
    [DeploymentStatus.Success]: 'text-success',
    [DeploymentStatus.Failure]: 'text-danger',
    [DeploymentStatus.Stopped]: 'text-muted',
    [DeploymentStatus.Rolledback]: 'text-muted'
};

const STATUS_LABELS: Record<DeploymentStatus, string> = {
    [DeploymentStatus.Pending]: 'Pending',
    [DeploymentStatus.Queued]: 'Queued',
    [DeploymentStatus.Building]: 'Building',
    [DeploymentStatus.Success]: 'Success',
    [DeploymentStatus.Failure]: 'Failed',
    [DeploymentStatus.Stopped]: 'Stopped',
    [DeploymentStatus.Rolledback]: 'Rolled back'
};

export const deploymentStatusColor = (status: DeploymentStatus): string =>
    STATUS_COLORS[status] ?? 'text-muted';

export const deploymentStatusLabel = (status: DeploymentStatus): string =>
    STATUS_LABELS[status] ?? status;

export const isDeploymentInProgress = (status: DeploymentStatus): boolean =>
    status === DeploymentStatus.Pending
    || status === DeploymentStatus.Queued
    || status === DeploymentStatus.Building;
