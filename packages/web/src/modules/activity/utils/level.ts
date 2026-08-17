import { ActivityLevel } from '@quantum/contracts/modules/activity/domain';
import type { ChipVariants } from '@heroui/react';

const LEVEL_COPY: Record<ActivityLevel, { label: string; color: NonNullable<ChipVariants['color']> }> = {
    [ActivityLevel.Info]: { label: 'Info', color: 'default' },
    [ActivityLevel.Success]: { label: 'Success', color: 'success' },
    [ActivityLevel.Progress]: { label: 'In progress', color: 'warning' },
    [ActivityLevel.Warn]: { label: 'Warning', color: 'warning' },
    [ActivityLevel.Error]: { label: 'Error', color: 'danger' }
};

export const activityLevelLabel = (level: ActivityLevel): string => LEVEL_COPY[level].label;

export const activityLevelColor = (level: ActivityLevel): NonNullable<ChipVariants['color']> =>
    LEVEL_COPY[level].color;
