import { ActivityLevel } from '@quantum/contracts/modules/activity/domain';
import { makeStatusMeta, type StatusColor } from '@/shared/utils/status';

const meta = makeStatusMeta<ActivityLevel, StatusColor>({
    [ActivityLevel.Info]: { label: 'Info', color: 'default' },
    [ActivityLevel.Success]: { label: 'Success', color: 'success' },
    [ActivityLevel.Progress]: { label: 'In progress', color: 'warning' },
    [ActivityLevel.Warn]: { label: 'Warning', color: 'warning' },
    [ActivityLevel.Error]: { label: 'Error', color: 'danger' }
});

export const activityLevelLabel = meta.label;

export const activityLevelColor = meta.color;
