import { Chip } from '@heroui/react';
import { databaseStatusColor, databaseStatusLabel } from '@/modules/database/utils/status';
import type { DatabaseStatus } from '@quantum/contracts/modules/database/domain';

const DatabaseStatusChip = ({ status }: { status: DatabaseStatus }) => (
    <Chip size='sm' variant='soft' color={databaseStatusColor(status)}>{databaseStatusLabel(status)}</Chip>
);

export default DatabaseStatusChip;
