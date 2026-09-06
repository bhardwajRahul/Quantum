import type { ApiResponse, PageOf } from '@quantum/contracts/shared/http';

export const unwrap = (payload: unknown): unknown => {
    const body = payload as ApiResponse<unknown> | undefined;
    if(!body?.meta) return body?.data;

    return {
        items: body.data as unknown[],
        meta: body.meta
    } satisfies PageOf<unknown>;
};
