import type { ErrorCode, ErrorTable } from '../../shared/errors';

export const AuthErrors = {
    domain: 'Authentication',
    causes: {
        EmailOrPasswordIncorrect: 401,
        Disabled: 403,
        Unauthorized: 401,
        InvalidToken: 401,
        Forbidden: 403,
        PasswordCurrentIncorrect: 400,
        PasswordsAreSame: 400,
        PasswordConfirmMismatch: 400,
        UserNotFound: 404
    }
} as const satisfies ErrorTable;

export type AuthErrorCode = ErrorCode<typeof AuthErrors>;
