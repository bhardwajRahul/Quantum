import { DeploymentStatus } from '@quantum/contracts/modules/deployment/domain';
import { makeStatusMeta } from '@/shared/utils/status';

const meta = makeStatusMeta<DeploymentStatus, string>({
    [DeploymentStatus.Pending]: { label: 'Pending', color: 'text-warning' },
    [DeploymentStatus.Queued]: { label: 'Queued', color: 'text-warning' },
    [DeploymentStatus.Building]: { label: 'Building', color: 'text-warning' },
    [DeploymentStatus.Success]: { label: 'Success', color: 'text-success' },
    [DeploymentStatus.Failure]: { label: 'Failed', color: 'text-danger' },
    [DeploymentStatus.Stopped]: { label: 'Stopped', color: 'text-muted' },
    [DeploymentStatus.Rolledback]: { label: 'Rolled back', color: 'text-muted' }
}, [DeploymentStatus.Pending, DeploymentStatus.Queued, DeploymentStatus.Building]);

export const deploymentStatusColor = (status: DeploymentStatus): string =>
    meta.color(status) ?? 'text-muted';

export const deploymentStatusLabel = (status: DeploymentStatus): string =>
    meta.label(status) ?? status;

export const isDeploymentInProgress = meta.isTransient;
