import type { AuthErrorCode } from '@quantum/contracts/modules/auth/errors';
import type { UserErrorCode } from '@quantum/contracts/modules/user/errors';

export type AuthSubmitErrorCode = AuthErrorCode | UserErrorCode;

export const authErrorMessages: Partial<Record<AuthSubmitErrorCode, string>> = {
    'Authentication::EmailOrPasswordIncorrect': 'Wrong email or password.',
    'Authentication::Disabled': 'This account is disabled.',
    'Authentication::Unauthorized': 'Your session has expired. Please sign in again.',
    'Authentication::InvalidToken': 'Your session has expired. Please sign in again.',
    'Authentication::PasswordConfirmMismatch': 'The passwords do not match.',
    'User::EmailAlreadyRegistered': 'This email is already registered.',
    'User::UsernameAlreadyTaken': 'That username is taken. Try another one.'
};

export const signUpErrorFields: Partial<Record<AuthSubmitErrorCode, 'email' | 'username' | 'passwordConfirm'>> = {
    'User::EmailAlreadyRegistered': 'email',
    'User::UsernameAlreadyTaken': 'username',
    'Authentication::PasswordConfirmMismatch': 'passwordConfirm'
};
