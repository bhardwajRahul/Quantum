import { beforeEach, describe, expect, it } from 'vitest';
import { endSession, isSessionExpired } from '@/shared/services/end-session';
import { useSessionStore } from '@/shared/store/session';

describe('isSessionExpired', () => {
    it('ends the session when the token is missing or malformed', () => {
        expect(isSessionExpired(401, 'Authentication::Unauthorized')).toBe(true);
    });

    it('ends the session when the token is expired or invalid', () => {
        expect(isSessionExpired(401, 'Authentication::InvalidToken')).toBe(true);
    });

    it('keeps the session on a 401 that is not about the token', () => {
        expect(isSessionExpired(401, 'Authentication::EmailOrPasswordIncorrect')).toBe(false);
        expect(isSessionExpired(401, 'User::NotFound')).toBe(false);
    });

    it('ignores every other status', () => {
        expect(isSessionExpired(403, 'Authentication::Unauthorized')).toBe(false);
        expect(isSessionExpired(200, 'Authentication::Unauthorized')).toBe(false);
    });
});

describe('endSession', () => {
    beforeEach(() => {
        localStorage.removeItem('quantum.session');
    });

    it('clears the store and the persisted token', async () => {
        useSessionStore.getState().setToken('live');

        await endSession();

        expect(useSessionStore.getState().token).toBeNull();
        expect(localStorage.getItem('quantum.session')).toBeNull();
    });
});
