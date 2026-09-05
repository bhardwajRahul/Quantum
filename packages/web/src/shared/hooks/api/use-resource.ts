import { useCallback, useEffect, useMemo, useState } from 'react';
import { toError } from '@/shared/utils/errors';
import { createApi, segmentOf } from '@/shared/api/create-api';
import type { ActionOf, EndpointTable } from '@/shared/api/create-api';
import {
    queryCache,
    useQueryStore,
    useRegisteredLoader
} from '@/shared/hooks/api/query-cache';
import type { QueryKey } from '@/shared/hooks/api/query-cache';
import type { Endpoint, InputOf, OutputOf } from '@quantum/contracts/shared/routing';

export type ListNames<T extends EndpointTable> = {
    readonly [K in keyof T & string]: InputOf<T[K]> extends never
        ? (Awaited<OutputOf<T[K]>> extends unknown[] ? K : never)
        : never;
}[keyof T & string];

export interface UseResourceOptions<T extends EndpointTable, L extends ListNames<T>>{
    list: L;
    request?: object | null;
    enabled?: boolean;
}

export interface ResourceState<O>{
    data: O | null;
    loading: boolean;
    error: Error | undefined;
    refresh: () => void;
}

type ActionsOf<T extends EndpointTable, L extends string> = {
    [K in keyof T & string as Exclude<K, L>]: ActionOf<T[K]>;
};

export type Resource<T extends EndpointTable, L extends ListNames<T>> = ResourceState<Awaited<OutputOf<T[L]>>> &
    ActionsOf<T, Extract<L, string>> & {
        pending: boolean;
    };

const refreshSegment = (segment: string, changed: boolean): Promise<void> =>
    changed ? queryCache.invalidateSegment(segment) : Promise.resolve();

export function useResource<T extends EndpointTable, L extends ListNames<T>>(
    routes: T,
    options: UseResourceOptions<T, L>
): Resource<T, L>{
    const { list, request, enabled } = options;
    const api = useMemo(() => createApi(routes), [routes]);
    const segment = useMemo(() => segmentOf(routes), [routes]);
    const requestJson = request === undefined ? null : JSON.stringify(request);

    const disabled = enabled === false || request === null;
    const key = useMemo<QueryKey | null>(() => {
        if(disabled) return null;
        return requestJson === null ? [segment, list] : [segment, list, JSON.parse(requestJson) as unknown];
    }, [disabled, segment, list, requestJson]);

    useRegisteredLoader(key, key === null ? null : (force) => (api[list] as (request?: object) => Promise<unknown>)(force ? { ...request, fresh: true } : { ...request }));

    useEffect(() => {
        if(key === null) return;
        void queryCache.load(key);
    }, [key]);

    const [actionState, setActionState] = useState<{ inFlight: number; error: Error | undefined }>({
        inFlight: 0,
        error: undefined
    });

    const actions = useMemo(() => {
        const table: Record<string, (request?: object) => Promise<unknown>> = {};

        for(const [name, endpoint] of Object.entries(routes)){
            if(name === list) continue;

            const changed = (endpoint as Endpoint).method !== 'GET';
            table[name] = async (request?: object) => {
                setActionState((state) => ({ inFlight: state.inFlight + 1, error: undefined }));

                try{
                    const data = await (api[name] as (request?: object) => Promise<unknown>)(request);
                    await refreshSegment(segment, changed);
                    return data;
                }catch(cause){
                    setActionState((state) => ({ ...state, error: toError(cause) }));
                    throw cause;
                }finally{
                    setActionState((state) => ({ ...state, inFlight: state.inFlight - 1 }));
                }
            };
        }

        return table;
    }, [api, list, segment, routes]);

    const snapshot = useQueryStore(key);

    const refresh = useCallback(() => {
        if(key === null) return;
        void queryCache.refresh([key]);
    }, [key]);

    return {
        ...(actions as unknown as ActionsOf<T, Extract<L, string>>),
        data: (snapshot.data as Awaited<OutputOf<T[L]>>) ?? null,
        loading: snapshot.loading,
        error: actionState.error ?? snapshot.error,
        pending: actionState.inFlight > 0,
        refresh
    };
}