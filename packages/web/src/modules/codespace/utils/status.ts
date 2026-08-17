import { CodespaceStatus } from '@quantum/contracts/modules/codespace/domain';
import type { ChipVariants } from '@heroui/react';

const STATUS_COPY: Record<CodespaceStatus, { label: string; color: NonNullable<ChipVariants['color']> }> = {
    [CodespaceStatus.Pending]: { label: 'Pending', color: 'warning' },
    [CodespaceStatus.Provisioning]: { label: 'Provisioning', color: 'warning' },
    [CodespaceStatus.Running]: { label: 'Running', color: 'success' },
    [CodespaceStatus.Stopped]: { label: 'Stopped', color: 'default' },
    [CodespaceStatus.Error]: { label: 'Error', color: 'danger' }
};

const TRANSIENT: CodespaceStatus[] = [
    CodespaceStatus.Pending,
    CodespaceStatus.Provisioning
];

export const codespaceStatusLabel = (status: CodespaceStatus): string => STATUS_COPY[status].label;

export const codespaceStatusColor = (status: CodespaceStatus): NonNullable<ChipVariants['color']> =>
    STATUS_COPY[status].color;

export const isCodespaceTransient = (status: CodespaceStatus): boolean => TRANSIENT.includes(status);
