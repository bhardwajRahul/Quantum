export type Request<A extends readonly unknown[], O> = (...args: A) => PromiseLike<O>;

export type PendingArgs<A extends readonly unknown[]> = { [K in keyof A]: A[K] | undefined };

export interface Query<T>{
    data: T | null;
    loading: boolean;
    error: Error | undefined;
    reload: () => void;
}

export interface QueryOptions<O, T>{
    select?: (data: O) => T;
    enabled?: boolean;
    dependsOn?: Query<unknown> | Query<unknown>[];
}

export interface PollOptions<T>{
    while: (data: T) => boolean;
    everyMs: number;
}

export interface MutationOptions<O>{
    onSuccess?: (data: O) => void;
}

export interface Mutation<A extends readonly unknown[], O>{
    run: (...args: A) => Promise<O>;
    loading: boolean;
    error: Error | undefined;
}

export type PathValues = Record<string, string | number>;

export interface CallOptions<I>{
    path?: PathValues;
    query?: object;
    body?: I | FormData;
    fresh?: boolean;
}

export interface QuerySnapshot<O>{
    args: string;
    status: 'loading' | 'success' | 'error';
    data: O | null;
    error: Error | undefined;
}
