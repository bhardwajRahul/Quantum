import { createAlova } from 'alova';
import type { ApiError as ApiErrorPayload } from '@quantum/contracts/shared/http';
import { env } from '@/shared/config/env';
import { useSessionStore } from '@/shared/store/session';
import { ApiError } from '@/shared/services/ApiError';
import { endSession, isSessionExpired } from '@/shared/services/end-session';
import { unwrap } from '@/shared/api/unwrap';
import adapterFetch from 'alova/fetch';
import ReactHook from 'alova/react';

export const alova = createAlova({
    baseURL: env.apiUrl,
    requestAdapter: adapterFetch(),
    statesHook: ReactHook,
    cacheFor: {
        GET: 30_000
    },

    beforeRequest(method){
        const token = useSessionStore.getState().token;
        const isJson = method.data !== undefined && !(method.data instanceof FormData);

        method.config.headers['Content-Type'] = isJson ? 'application/json' : '';
        if(token) method.config.headers.Authorization = `Bearer ${token}`;
    },

    responded: {
        async onSuccess(response){
            const payload = response.status === 204
                ? undefined
                : await response.json().catch(() => undefined);

            if(!response.ok){
                const message = (payload as ApiErrorPayload | undefined)?.error ?? response.statusText;
                if(isSessionExpired(response.status, message)) await endSession();
                throw new ApiError(response.status, message, payload);
            }

            return unwrap(payload);
        },

        onError(error){
            if(error instanceof ApiError) throw error;
            throw new ApiError(0, 'Network request failed', undefined, { cause: error });
        }
    }
});
