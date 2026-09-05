import { CodespaceStatus } from '@quantum/contracts/modules/codespace/domain';
import { makeStatusMeta, type StatusColor } from '@/shared/utils/status';

const meta = makeStatusMeta<CodespaceStatus, StatusColor>({
    [CodespaceStatus.Pending]: { label: 'Pending', color: 'warning' },
    [CodespaceStatus.Provisioning]: { label: 'Provisioning', color: 'warning' },
    [CodespaceStatus.Running]: { label: 'Running', color: 'success' },
    [CodespaceStatus.Stopped]: { label: 'Stopped', color: 'default' },
    [CodespaceStatus.Error]: { label: 'Error', color: 'danger' }
}, [CodespaceStatus.Pending, CodespaceStatus.Provisioning]);

export const codespaceStatusLabel = meta.label;

export const codespaceStatusColor = meta.color;

export const isCodespaceTransient = meta.isTransient;
