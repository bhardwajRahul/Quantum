import { beforeEach, describe, expect, it, vi } from 'vitest';

const KEY = 'quantum.session';

const load = async () => {
    vi.resetModules();
    return (await import('@/shared/store/session')).useSessionStore;
};

describe('session store', () => {
    beforeEach(() => {
        localStorage.removeItem(KEY);
    });

    it('hydrates the persisted token on the first render', async () => {
        localStorage.setItem(KEY, 'persisted');

        const store = await load();

        expect(store.getState().token).toBe('persisted');
    });

    it('starts empty when nothing is persisted', async () => {
        const store = await load();

        expect(store.getState().token).toBeNull();
    });

    it('survives a reload once a token is set', async () => {
        const store = await load();
        store.getState().setToken('fresh');

        expect(localStorage.getItem(KEY)).toBe('fresh');
        expect((await load()).getState().token).toBe('fresh');
    });

    it('drops the token from the store and from storage on clear', async () => {
        localStorage.setItem(KEY, 'persisted');
        const store = await load();

        store.getState().clear();

        expect(store.getState().token).toBeNull();
        expect(localStorage.getItem(KEY)).toBeNull();
        expect((await load()).getState().token).toBeNull();
    });
});
