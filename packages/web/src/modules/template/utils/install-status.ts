import { TemplateInstallStatus } from '@quantum/contracts/modules/template/domain';
import { makeStatusMeta, type StatusColor } from '@/shared/utils/status';

const meta = makeStatusMeta<TemplateInstallStatus, StatusColor>({
    [TemplateInstallStatus.Pending]: { label: 'Pending', color: 'warning' },
    [TemplateInstallStatus.Provisioning]: { label: 'Installing', color: 'warning' },
    [TemplateInstallStatus.Running]: { label: 'Running', color: 'success' },
    [TemplateInstallStatus.Stopped]: { label: 'Stopped', color: 'default' },
    [TemplateInstallStatus.Error]: { label: 'Error', color: 'danger' }
}, [TemplateInstallStatus.Pending, TemplateInstallStatus.Provisioning]);

export const installStatusLabel = meta.label;

export const installStatusColor = meta.color;

export const isInstallTransient = meta.isTransient;

export const isInstallRunning = (status: TemplateInstallStatus): boolean => status === TemplateInstallStatus.Running;
