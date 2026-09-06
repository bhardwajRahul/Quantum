import { useEffect, useRef, useState } from 'react';
import { Method } from 'alova';
import { toError } from '@/shared/utils/errors';
import type { PendingArgs, Query, QueryOptions, QuerySnapshot, Request } from '@/shared/contracts/api';

const dependenciesOf = (dependsOn: QueryOptions<never, never>['dependsOn']): Query<unknown>[] =>
    dependsOn === undefined ? [] : Array.isArray(dependsOn) ? dependsOn : [dependsOn];

const dispatch = <O>(pending: PromiseLike<O>, force: boolean): PromiseLike<O> =>
    force && pending instanceof Method ? pending.send(true) as Promise<O> : pending;

export const useQuery = <A extends readonly unknown[], O, T = O>(
    request: Request<A, O>,
    args: PendingArgs<A> = [] as unknown as PendingArgs<A>,
    { select, enabled = true, dependsOn }: QueryOptions<O, T> = {}
): Query<T> => {
    const upstream = dependenciesOf(dependsOn);
    const failed = upstream.find((query) => query.error !== undefined);
    const waiting = upstream.some((query) => query.loading);
    const ready = enabled && !failed && !waiting && args.every((arg) => arg !== undefined);

    const [attempt, setAttempt] = useState(0);
    const [snapshot, setSnapshot] = useState<QuerySnapshot<O> | null>(null);

    const key = ready ? JSON.stringify(args) : null;

    const latest = useRef({ request, args });
    const forced = useRef(false);
    useEffect(() => {
        latest.current = { request, args };
    });

    useEffect(() => {
        if(key === null){
            setSnapshot(null);
            return;
        }

        let active = true;
        const force = forced.current;
        forced.current = false;

        setSnapshot((previous) => ({
            args: key,
            status: 'loading',
            data: previous?.args === key ? previous.data : null,
            error: undefined
        }));

        dispatch(latest.current.request(...latest.current.args as A), force).then(
            (data) => {
                if(active) setSnapshot({ args: key, status: 'success', data, error: undefined });
            },
            (cause: unknown) => {
                if(active) setSnapshot({ args: key, status: 'error', data: null, error: toError(cause) });
            }
        );

        return () => {
            active = false;
        };
    }, [key, attempt]);

    const fresh = snapshot?.args === key ? snapshot : null;
    const data = fresh?.data ?? null;

    const fetching = waiting || (ready && (fresh === null || fresh.status === 'loading'));

    return {
        loading: fetching && data === null,
        refreshing: fetching && data !== null,
        data: data === null ? null : select ? select(data) : data as unknown as T,
        error: failed?.error ?? fresh?.error,
        reload: () => {
            if(failed) return failed.reload();
            forced.current = true;
            setAttempt((value) => value + 1);
        }
    };
};
