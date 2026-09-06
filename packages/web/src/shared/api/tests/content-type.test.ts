import { describe, expect, it, vi, beforeEach } from 'vitest';
import { authApi } from '@/modules/auth/api/api';
import { call } from '@/shared/api/call';
import { authRoutes } from '@quantum/contracts/modules/auth/routes';
import { repositoryRoutes } from '@quantum/contracts/modules/repository/routes';
import { toRequest } from '@/shared/tests/fetch-stub';

interface Captured{
    method: string;
    url: string;
    contentType: string | null;
}

const captured: Captured[] = [];

beforeEach(() => {
    captured.length = 0;

    vi.stubGlobal('fetch', vi.fn(async (input: unknown, init?: RequestInit) => {
        const request = toRequest(input, init);

        captured.push({
            method: request.method,
            url: request.url,
            contentType: request.headers.get('content-type')
        });

        return new Response(null, { status: 204 });
    }));
});

describe('outgoing content type', () => {
    it('omits it on a bodyless DELETE', async () => {
        await call(repositoryRoutes.remove, { path: { id: 7 } });

        expect(captured[0]?.method).toBe('DELETE');
        expect(captured[0]?.url).toContain('/repository/7');
        expect(captured[0]?.contentType).toBeNull();
    });

    it('still sends it when there is a body', async () => {
        await authApi.signIn({ body: { email: 'rody@quantum.dev', password: 'secret-password' } });

        expect(captured[0]?.method).toBe('POST');
        expect(captured[0]?.contentType).toContain('application/json');
    });

    it('leaves a multipart body to the browser', async () => {
        const body = new FormData();
        body.append('file', new Blob(['png'], { type: 'image/png' }), 'file.png');

        await call(authRoutes.signUp, { body });

        expect(captured[0]?.method).toBe('POST');
        expect(captured[0]?.contentType).not.toContain('application/json');
    });
});
