import { invalidateCache } from 'alova';
import type { AuthErrorCode } from '@quantum/contracts/modules/auth/errors';
import { useSessionStore } from '@/shared/store/session';

const EXPIRED_CODES: AuthErrorCode[] = ['Authentication::Unauthorized', 'Authentication::InvalidToken'];

export const isSessionExpired = (status: number, code: string): boolean =>
    status === 401 && EXPIRED_CODES.includes(code as AuthErrorCode);

export const endSession = async () => {
    await invalidateCache();
    useSessionStore.getState().clear();
};
