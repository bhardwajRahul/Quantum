import { ContainerStatus } from '@quantum/contracts/modules/docker/domain';
import { makeStatusMeta, type StatusColor } from '@/shared/utils/status';

const meta = makeStatusMeta<ContainerStatus, StatusColor>({
    [ContainerStatus.Created]: { label: 'Created', color: 'default' },
    [ContainerStatus.Running]: { label: 'Running', color: 'success' },
    [ContainerStatus.Stopped]: { label: 'Stopped', color: 'default' },
    [ContainerStatus.Reloading]: { label: 'Reloading', color: 'warning' },
    [ContainerStatus.Restarting]: { label: 'Restarting', color: 'warning' },
    [ContainerStatus.Building]: { label: 'Building', color: 'warning' },
    [ContainerStatus.Error]: { label: 'Error', color: 'danger' }
}, [ContainerStatus.Reloading, ContainerStatus.Restarting, ContainerStatus.Building]);

/**
 * A repository with no container yet has no runtime state to report, which is not the
 * same thing as being stopped — saying "Stopped" for something that was never built is
 * how the list came to disagree with the deployment it was showing.
 */
export const containerStatusLabel = (status: ContainerStatus | null): string =>
    status === null ? 'Not deployed' : meta.label(status);

export const containerStatusColor = (status: ContainerStatus | null): StatusColor =>
    status === null ? 'default' : meta.color(status);

export const isContainerRunning = (status: ContainerStatus | null): boolean =>
    status === ContainerStatus.Running;
