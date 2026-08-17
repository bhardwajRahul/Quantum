import { DatabaseStatus } from '@quantum/contracts/modules/database/domain';
import type { ChipVariants } from '@heroui/react';

const STATUS_COPY: Record<DatabaseStatus, { label: string; color: NonNullable<ChipVariants['color']> }> = {
    [DatabaseStatus.Pending]: { label: 'Pending', color: 'warning' },
    [DatabaseStatus.Provisioning]: { label: 'Provisioning', color: 'warning' },
    [DatabaseStatus.Running]: { label: 'Running', color: 'success' },
    [DatabaseStatus.Stopped]: { label: 'Stopped', color: 'default' },
    [DatabaseStatus.Error]: { label: 'Error', color: 'danger' },
    [DatabaseStatus.BackingUp]: { label: 'Backing up', color: 'warning' }
};

const TRANSIENT: DatabaseStatus[] = [DatabaseStatus.Pending, DatabaseStatus.Provisioning, DatabaseStatus.BackingUp];

export const databaseStatusLabel = (status: DatabaseStatus): string => STATUS_COPY[status].label;

export const databaseStatusColor = (status: DatabaseStatus): NonNullable<ChipVariants['color']> => STATUS_COPY[status].color;

export const isDatabaseTransient = (status: DatabaseStatus): boolean => TRANSIENT.includes(status);
