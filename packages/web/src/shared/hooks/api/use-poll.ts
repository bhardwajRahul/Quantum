import { useEffect, useRef } from 'react';
import type { Query } from '@/shared/contracts/api';

export const usePoll = <T>(query: Query<T>, everyMs: number, isPending: boolean) => {
    const latestReload = useRef(query.reload);

    latestReload.current = query.reload;

    useEffect(() => {
        if(!isPending) return;

        const timer = setInterval(() => latestReload.current(), everyMs);

        return () => clearInterval(timer);
    }, [isPending, everyMs]);
};
