import { Chip } from '@heroui/react';
import { domainStatusColor, domainStatusLabel } from '@/modules/domain/utils/status';
import type { DomainStatus } from '@quantum/contracts/modules/domain/domain';

const DomainStatusChip = ({ status }: { status: DomainStatus }) => (
    <Chip size='sm' variant='soft' color={domainStatusColor(status)}>{domainStatusLabel(status)}</Chip>
);

export default DomainStatusChip;
