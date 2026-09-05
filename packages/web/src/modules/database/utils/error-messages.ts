import type { DatabaseErrorCode } from '@quantum/contracts/modules/database/errors';
import { forbidden, notFound } from '@/shared/utils/error-messages';

export const databaseErrorMessages: Partial<Record<DatabaseErrorCode, string>> = {
    'Database::NotFound': notFound('database'),
    'Database::Forbidden': forbidden('database'),
    'Database::NameAlreadyTaken': 'That name is already taken in this project.'
};
