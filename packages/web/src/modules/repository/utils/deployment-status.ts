import { DeploymentStatus } from '@quantum/contracts/modules/deployment/domain';
import { makeStatusMeta, type StatusColor } from '@/shared/utils/status';

const meta = makeStatusMeta<DeploymentStatus, StatusColor>({
    [DeploymentStatus.Pending]: { label: 'Pending', color: 'warning' },
    [DeploymentStatus.Queued]: { label: 'Queued', color: 'warning' },
    [DeploymentStatus.Building]: { label: 'Building', color: 'warning' },
    [DeploymentStatus.Success]: { label: 'Success', color: 'success' },
    [DeploymentStatus.Failure]: { label: 'Failed', color: 'danger' },
    [DeploymentStatus.Stopped]: { label: 'Stopped', color: 'default' },
    [DeploymentStatus.Rolledback]: { label: 'Rolled back', color: 'default' }
}, [DeploymentStatus.Pending, DeploymentStatus.Queued, DeploymentStatus.Building]);

export const deploymentStatusColor = (status: DeploymentStatus): StatusColor =>
    meta.color(status) ?? 'default';

export const deploymentStatusLabel = (status: DeploymentStatus): string =>
    meta.label(status) ?? status;

export const isDeploymentInProgress = meta.isTransient;
