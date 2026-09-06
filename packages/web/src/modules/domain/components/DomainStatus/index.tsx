import StatusDot from '@/shared/components/StatusDot';
import { domainStatusColor, domainStatusLabel } from '@/modules/domain/utils/status';
import type { DomainStatus } from '@quantum/contracts/modules/domain/domain';

const DomainStatusChip = ({ status }: { status: DomainStatus }) => (
    <StatusDot color={domainStatusColor(status)} label={domainStatusLabel(status)} />
);

export default DomainStatusChip;
