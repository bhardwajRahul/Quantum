import { useEffect } from 'react';
import type { PollOptions, Query } from '@/shared/contracts/api';

export const usePolledQuery = <T,>(query: Query<T>, { while: shouldPoll, everyMs }: PollOptions<T>): Query<T> => {
    const polling = query.data !== null && shouldPoll(query.data);

    useEffect(() => {
        if(!polling) return;

        const timer = setInterval(query.reload, everyMs);

        return () => clearInterval(timer);
    }, [polling, everyMs, query.reload]);

    return query;
};
