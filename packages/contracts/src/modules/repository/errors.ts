import type { ErrorCode, ErrorTable } from '../../shared/errors';

export const RepositoryErrors = {
    domain: 'Repository',
    causes: {
        NotFound: 404,
        Forbidden: 403,
        AliasAlreadyTaken: 409,
        InvalidSignature: 401,
        OperationFailed: 500,
        InvalidVolume: 400
    }
} as const satisfies ErrorTable;

export type RepositoryErrorCode = ErrorCode<typeof RepositoryErrors>;
