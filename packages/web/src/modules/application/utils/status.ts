import { DatabaseStatus } from '@quantum/contracts/modules/database/domain';
import { makeStatusMeta, type StatusColor } from '@/shared/utils/status';

const meta = makeStatusMeta<DatabaseStatus, StatusColor>({
    [DatabaseStatus.Pending]: { label: 'Pending', color: 'warning' },
    [DatabaseStatus.Provisioning]: { label: 'Provisioning', color: 'warning' },
    [DatabaseStatus.Running]: { label: 'Running', color: 'success' },
    [DatabaseStatus.Stopped]: { label: 'Stopped', color: 'default' },
    [DatabaseStatus.Error]: { label: 'Error', color: 'danger' },
    [DatabaseStatus.BackingUp]: { label: 'Backing up', color: 'warning' }
}, [DatabaseStatus.Pending, DatabaseStatus.Provisioning, DatabaseStatus.BackingUp]);

export const databaseStatusLabel = meta.label;

export const databaseStatusColor = meta.color;

export const isDatabaseTransient = meta.isTransient;
