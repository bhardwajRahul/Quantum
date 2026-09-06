import { describe, expect, it, vi } from 'vitest';
import { createApi, segmentOf } from '@/shared/api/create-api';
import { call } from '@/shared/api/call';
import { del, get, post } from '@quantum/contracts/shared/routing';

vi.mock('@/shared/api/call', () => ({ call: vi.fn(() => Promise.resolve(1)) }));

const exampleRoutes = {
    list: get<number[]>('/project'),
    create: post<{ name: string }, { id: number }>('/project'),
    get: get<{ id: number }>('/project/:id'),
    remove: del('/project/:id')
};

describe('createApi', () => {
    it('exposes one callable per endpoint and forwards the request to call', async () => {
        const api = createApi(exampleRoutes);

        await api.list();
        await api.create({ body: { name: 'a' } });
        await api.get({ path: { id: 7 } });
        await api.remove({ path: { id: 7 }, fresh: true });

        expect(call).toHaveBeenCalledTimes(4);
        expect(call).toHaveBeenNthCalledWith(1, exampleRoutes.list, {});
        expect(call).toHaveBeenNthCalledWith(2, exampleRoutes.create, { body: { name: 'a' } });
        expect(call).toHaveBeenNthCalledWith(3, exampleRoutes.get, { path: { id: 7 } });
        expect(call).toHaveBeenNthCalledWith(4, exampleRoutes.remove, { path: { id: 7 }, fresh: true });
    });

    it('derives the module segment from the second stable path part', () => {
        expect(segmentOf(exampleRoutes)).toBe('project');
        expect(segmentOf({ mine: get<unknown[]>('/repository/me') })).toBe('repository');
        expect(segmentOf({ mine: get<unknown[]>('/activity') })).toBe('activity');
    });
});