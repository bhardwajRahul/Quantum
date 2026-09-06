import { describe, expect, it, vi, beforeEach } from 'vitest';
import { invalidateCache } from 'alova';
import { call } from '@/shared/api/call';
import { get, del } from '@quantum/contracts/shared/routing';

const listRoute = get<{ id: number }[]>('/probe');
const removeRoute = del('/probe/:id');

let items: { id: number }[] = [];

beforeEach(async () => {
    items = [{ id: 1 }, { id: 2 }];
    await invalidateCache();
    vi.stubGlobal('fetch', vi.fn(async (url: string, init?: RequestInit) => {
        if((init?.method ?? 'GET') === 'GET'){
            return new Response(JSON.stringify({ data: items }), {
                status: 200,
                headers: { 'content-type': 'application/json' }
            });
        }
        const removed = Number(String(url).split('/').pop());
        items = items.filter((item) => item.id !== removed);
        return new Response(null, { status: 204 });
    }));
});

describe('call', () => {
    it('sees the write when fresh is set', async () => {
        await call(listRoute);
        await call(removeRoute, { path: { id: 1 } });

        await expect(call(listRoute, { fresh: true })).resolves.toEqual([{ id: 2 }]);
    });

    it('still serves the cache when fresh is not set', async () => {
        await call(listRoute);
        await call(removeRoute, { path: { id: 1 } });

        await expect(call(listRoute)).resolves.toEqual([{ id: 1 }, { id: 2 }]);
    });
});
