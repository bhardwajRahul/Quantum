import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useSession } from '@/modules/auth/hooks/use-session';
import { authApi } from '@/modules/auth/api/api';
import { useSessionStore } from '@/shared/store/session';
import { ApiError } from '@/shared/services/ApiError';
import { renderHook } from '@/shared/tests/render-hook';
import { resetStores } from '@/shared/tests/store-reset';
import type { HookHarness } from '@/shared/tests/render-hook';
import type { Session } from '@/shared/contracts/routing/session';
import type { User } from '@quantum/contracts/modules/user/domain';

const USER = { id: 1, username: 'rody', fullname: 'Rody', email: 'rody@quantum.dev' } as User;

const answers = (value: User) => vi.spyOn(authApi, 'me').mockResolvedValue(value);
const fails = (status: number, message: string) =>
    vi.spyOn(authApi, 'me').mockRejectedValue(new ApiError(status, message));

let harness: HookHarness<Session> | undefined;

const session = async () => {
    harness = await renderHook(() => useSession());
    await harness.flush();
    return harness;
};

describe('useSession', () => {
    beforeEach(() => {
        useSessionStore.getState().setToken('a-token');
    });

    afterEach(async () => {
        await harness?.unmount();
        harness = undefined;
        resetStores();
    });

    it('is authenticated once the identity resolves', async () => {
        answers(USER);
        const harness = await session();

        expect(harness.current.isAuthenticated).toBe(true);
        expect(harness.current.isUnreachable).toBe(false);
        expect(harness.current.user).toEqual(USER);
    });

    it('is not authenticated without a token', async () => {
        useSessionStore.getState().clear();
        const harness = await session();

        expect(harness.current.isAuthenticated).toBe(false);
        expect(harness.current.isUnreachable).toBe(false);
    });

    it('drops authentication when the server rejects the identity', async () => {
        fails(404, 'Authentication::UserNotFound');
        const harness = await session();

        expect(harness.current.isAuthenticated).toBe(false);
        expect(harness.current.isUnreachable).toBe(false);
    });

    it('reports unreachable instead of signing out when the api is down', async () => {
        fails(0, 'Network request failed');
        const harness = await session();

        expect(harness.current.isUnreachable).toBe(true);
        expect(useSessionStore.getState().token).toBe('a-token');
    });

    it('treats a server fault as unreachable, not as a rejection', async () => {
        fails(500, 'Internal Server Error');
        const harness = await session();

        expect(harness.current.isUnreachable).toBe(true);
        expect(harness.current.isAuthenticated).toBe(true);
    });
});
