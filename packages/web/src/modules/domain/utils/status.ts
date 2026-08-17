import { DomainStatus } from '@quantum/contracts/modules/domain/domain';
import type { ChipVariants } from '@heroui/react';

const STATUS_COPY: Record<DomainStatus, { label: string; color: NonNullable<ChipVariants['color']> }> = {
    [DomainStatus.Pending]: { label: 'Pending', color: 'warning' },
    [DomainStatus.Active]: { label: 'Active', color: 'success' },
    [DomainStatus.Error]: { label: 'Error', color: 'danger' }
};

export const domainStatusLabel = (status: DomainStatus): string => STATUS_COPY[status].label;

export const domainStatusColor = (status: DomainStatus): NonNullable<ChipVariants['color']> =>
    STATUS_COPY[status].color;
