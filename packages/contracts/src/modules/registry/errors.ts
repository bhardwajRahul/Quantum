import type { ErrorCode, ErrorTable } from '../../shared/errors';

export const RegistryCredentialErrors = {
    domain: 'RegistryCredential',
    causes: {
        NotFound: 404,
        Forbidden: 403,
        AlreadyExists: 409,
        InvalidRegistry: 400
    }
} as const satisfies ErrorTable;

export type RegistryCredentialErrorCode = ErrorCode<typeof RegistryCredentialErrors>;
