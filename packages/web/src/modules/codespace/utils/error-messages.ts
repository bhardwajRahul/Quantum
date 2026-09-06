import type { CodespaceErrorCode } from '@quantum/contracts/modules/codespace/errors';
import { forbidden, notFound } from '@/shared/utils/error-messages';

export const codespaceErrorMessages: Partial<Record<CodespaceErrorCode, string>> = {
    'Codespace::NotFound': notFound('codespace'),
    'Codespace::Forbidden': forbidden('codespace'),
    'Codespace::ProvisionFailed': 'The codespace failed to provision. Try creating it again.',
    'Codespace::TargetNotReady': 'Deploy the application first; VS Code opens the files of its running containers.'
};
