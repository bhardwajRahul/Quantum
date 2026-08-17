import type { DatabaseErrorCode } from '@quantum/contracts/modules/database/errors';

export const databaseErrorMessages: Partial<Record<DatabaseErrorCode, string>> = {
    'Database::NotFound': 'That database no longer exists.',
    'Database::Forbidden': 'You do not have access to that database.',
    'Database::NameAlreadyTaken': 'That name is already taken in this project.',
    'Database::ProvisionFailed': 'Provisioning failed. Try again.'
};
