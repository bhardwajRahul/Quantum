import { DomainStatus } from '@quantum/contracts/modules/domain/domain';
import { makeStatusMeta, type StatusColor } from '@/shared/utils/status';

const meta = makeStatusMeta<DomainStatus, StatusColor>({
    [DomainStatus.Pending]: { label: 'Pending', color: 'warning' },
    [DomainStatus.Active]: { label: 'Active', color: 'success' },
    [DomainStatus.Error]: { label: 'Error', color: 'danger' }
});

export const domainStatusLabel = meta.label;

export const domainStatusColor = meta.color;
