import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { invalidateCache } from 'alova';
import { toError } from '@/shared/utils/errors';
import { createApi, segmentOf } from '@/shared/api/create-api';
import type { ActionOf, EndpointTable } from '@/shared/api/create-api';
import {
    queryCache,
    useQueryStore,
    useRegisteredLoader
} from '@/shared/hooks/api/query-cache';
import type { QueryKey } from '@/shared/hooks/api/query-cache';
import type { Endpoint, InputOf, OutputOf, QueryEndpoint } from '@quantum/contracts/shared/routing';

export type ListNames<T extends EndpointTable> = {
    readonly [K in keyof T & string]: Awaited<OutputOf<T[K]>> extends unknown[]
        ? (InputOf<T[K]> extends never ? K : T[K] extends QueryEndpoint<never, unknown> ? K : never)
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
    refreshing: boolean;
    error: Error | undefined;
    refresh: () => void;
    patch: (updater: (data: O) => O) => () => void;
}

export type OptimisticAction<E extends Endpoint<never, unknown>, O> =
    (request?: Parameters<ActionOf<E>>[0], optimistic?: (data: O) => O) => ReturnType<ActionOf<E>>;

type ActionsOf<T extends EndpointTable, L extends string, O> = {
    [K in keyof T & string as Exclude<K, L>]: OptimisticAction<T[K], O>;
};

export type Resource<T extends EndpointTable, L extends ListNames<T>> = ResourceState<Awaited<OutputOf<T[L]>>> &
    ActionsOf<T, Extract<L, string>, Awaited<OutputOf<T[L]>>> & {
        pending: boolean;
    };

const refreshSegment = async (segment: string, changed: boolean): Promise<void> => {
    if(!changed) return;

    await invalidateCache();
    await queryCache.invalidateSegment(segment);
};

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

    const keyRef = useRef<QueryKey | null>(key);
    useEffect(() => {
        keyRef.current = key;
    }, [key]);

    const [actionState, setActionState] = useState<{ inFlight: number; error: Error | undefined }>({
        inFlight: 0,
        error: undefined
    });

    const actions = useMemo(() => {
        const table: Record<string, (request?: object, optimistic?: (data: unknown) => unknown) => Promise<unknown>> = {};

        for(const [name, endpoint] of Object.entries(routes)){
            if(name === list) continue;

            const changed = (endpoint as Endpoint).method !== 'GET';
            table[name] = async (request?: object, optimistic?: (data: unknown) => unknown) => {
                const rollback = optimistic !== undefined && keyRef.current !== null
                    ? queryCache.patch(keyRef.current, optimistic)
                    : undefined;

                setActionState((state) => ({ inFlight: state.inFlight + 1, error: undefined }));

                try{
                    const data = await (api[name] as (request?: object) => Promise<unknown>)(request);
                    await refreshSegment(segment, changed);
                    return data;
                }catch(cause){
                    rollback?.();
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

    const patch = useCallback((updater: (data: Awaited<OutputOf<T[L]>>) => Awaited<OutputOf<T[L]>>) => {
        if(key === null) return () => {};
        return queryCache.patch(key, updater as (data: unknown) => unknown);
    }, [key]);

    return {
        ...(actions as unknown as ActionsOf<T, Extract<L, string>, Awaited<OutputOf<T[L]>>>),
        data: (snapshot.data as Awaited<OutputOf<T[L]>>) ?? null,
        loading: snapshot.loading,
        refreshing: snapshot.refreshing,
        error: actionState.error ?? snapshot.error,
        pending: actionState.inFlight > 0,
        refresh,
        patch
    };
}