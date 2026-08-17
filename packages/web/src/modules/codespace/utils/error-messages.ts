import type { CodespaceErrorCode } from '@quantum/contracts/modules/codespace/errors';

export const codespaceErrorMessages: Partial<Record<CodespaceErrorCode, string>> = {
    'Codespace::NotFound': 'That codespace no longer exists.',
    'Codespace::Forbidden': 'You do not have access to that codespace.',
    'Codespace::ProvisionFailed': 'The codespace failed to provision. Try creating it again.'
};
