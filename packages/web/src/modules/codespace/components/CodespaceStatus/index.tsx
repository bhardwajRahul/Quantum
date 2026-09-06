import { Chip } from '@heroui/react';
import { codespaceStatusColor, codespaceStatusLabel } from '@/modules/codespace/utils/status';
import type { CodespaceStatus } from '@quantum/contracts/modules/codespace/domain';

const CodespaceStatusChip = ({ status }: { status: CodespaceStatus }) => (
    <Chip size='sm' variant='soft' color={codespaceStatusColor(status)}>{codespaceStatusLabel(status)}</Chip>
);

export default CodespaceStatusChip;
