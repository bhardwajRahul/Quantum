import type { ErrorCode, ErrorTable } from '../../shared/errors';

export const UserErrors = {
    domain: 'User',
    causes: {
        NotFound: 404,
        UsernameAlreadyTaken: 409,
        EmailAlreadyRegistered: 409
    }
} as const satisfies ErrorTable;

export type UserErrorCode = ErrorCode<typeof UserErrors>;
