import { useState } from 'react';
import { toError } from '@/shared/utils/errors';
import type { Mutation, MutationOptions, Request } from '@/shared/contracts/api';

export const useMutation = <A extends readonly unknown[], O>(
    request: Request<A, O>,
    { onSuccess }: MutationOptions<O> = {}
): Mutation<A, O> => {
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<Error | undefined>(undefined);

    const run = async (...args: A): Promise<O> => {
        setLoading(true);
        setError(undefined);

        try{
            const data = await request(...args);
            onSuccess?.(data);
            return data;
        }catch(cause){
            setError(toError(cause));
            throw cause;
        }finally{
            setLoading(false);
        }
    };

    return { run, loading, error };
};
