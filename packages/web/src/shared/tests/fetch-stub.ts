import { vi } from 'vitest';

export const capturedRequests: Request[] = [];

export const toRequest = (input: unknown, init?: RequestInit): Request => {
    if (input instanceof Request) {
        return input;
    }

    return new Request(new URL(String(input), 'http://localhost/'), init);
};

export const respondWith = (status: number, body?: unknown): void => {
    vi.stubGlobal('fetch', vi.fn(async (input: unknown, init?: RequestInit) => {
        const request = toRequest(input, init);

        capturedRequests.push(request);

        if (body === undefined) {
            return new Response(null, { status });
        }

        return new Response(JSON.stringify(body), { status });
    }));
};

export const resetFetchStub = (): void => {
    capturedRequests.length = 0;
    vi.unstubAllGlobals();
};
