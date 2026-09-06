import type { ErrorCode, ErrorTable } from '../../shared/errors';

export const DatabaseErrors = {
    domain: 'Database',
    causes: {
        NotFound: 404,
        Forbidden: 403,
        NameAlreadyTaken: 409,
        ProvisionFailed: 500
    }
} as const satisfies ErrorTable;

export type DatabaseErrorCode = ErrorCode<typeof DatabaseErrors>;
