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

export const containerStatusLabel = (status: ContainerStatus | null): string =>
    status === null ? 'Not deployed' : meta.label(status);

export const containerStatusColor = (status: ContainerStatus | null): StatusColor =>
    status === null ? 'default' : meta.color(status);

export const isContainerRunning = (status: ContainerStatus | null): boolean =>
    status === ContainerStatus.Running;

export const isContainerTransient = (status: ContainerStatus | null): boolean =>
    status !== null && meta.isTransient(status);
