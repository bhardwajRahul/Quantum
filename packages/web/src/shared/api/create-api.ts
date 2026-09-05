import { call } from '@/shared/api/call';
import type { CallOptions, PathValues } from '@/shared/contracts/api';
import type { Endpoint, InputOf, OutputOf, HttpMethod } from '@quantum/contracts/shared/routing';

export interface EndpointTable{
    [name: string]: Endpoint<never, unknown>;
}

interface RequestTarget{
    path?: PathValues;
    query?: object;
    fresh?: boolean;
}

interface RequestBody<Input>{
    body: Input;
}

export type RequestOf<E extends Endpoint> = [InputOf<E>] extends [never] ? RequestTarget : RequestTarget & RequestBody<InputOf<E>>;

export type ActionOf<E extends Endpoint> = (request?: RequestOf<E>) => Promise<OutputOf<E>>;

export type Api<T extends EndpointTable> = {
    [K in keyof T & string]: ActionOf<T[K]>;
};

export const createApi = <T extends EndpointTable>(routes: T): Api<T> => {
    const api: Record<string, unknown> = {};

    for(const [name, endpoint] of Object.entries(routes)){
        api[name] = (request?: object) => {
            const { path, query, fresh, ...rest } = (request ?? {}) as RequestTarget & Record<string, unknown>;

            const options: CallOptions<unknown> = {};
            if(path !== undefined) options.path = path;
            if(query !== undefined) options.query = query;
            if(fresh === true) options.fresh = true;
            const body = rest.body as never;
            if(body !== undefined) options.body = body;

            return call(endpoint as Endpoint<unknown, unknown>, options);
        };
    }

    return api as unknown as Api<T>;
};

export const segmentOf = (routes: EndpointTable): string => {
    for(const endpoint of Object.values(routes)){
        const parts = endpoint.path.split('/').filter((part) => part !== '' && !part.startsWith(':') && part !== '*');
        if(parts.length > 0) return parts[0];
    }

    throw new Error('createApi could not derive a segment from the route table');
};

export const isWrite = (method: HttpMethod): boolean => method !== 'GET';