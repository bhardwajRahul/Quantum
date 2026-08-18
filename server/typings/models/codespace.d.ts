export type { ICodespace } from '@models/codespace';

export type CodespaceStatus =
    | 'pending'
    | 'provisioning'
    | 'running'
    | 'stopped'
    | 'error';
