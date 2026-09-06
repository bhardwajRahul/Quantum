import { useQuery } from '@/shared/hooks/api/use-query';
import { useSessionStore } from '@/shared/store/session';
import { ApiError } from '@/shared/services/ApiError';
import { authApi } from '@/modules/auth/api/api';
import type { Session } from '@/shared/contracts/routing/session';

export const useSession = (): Session => {
    const token = useSessionStore((state) => state.token);
    const { data: user, loading, error, reload } = useQuery(authApi.me, [], { enabled: !!token });

    const failure = error instanceof ApiError ? error : undefined;
    const isServerFault = failure !== undefined && (failure.isNetworkError || failure.status >= 500);
    const isRejected = error !== undefined && !isServerFault;

    return {
        token,
        user,
        isAuthenticated: !!token && !isRejected,
        isLoading: loading,
        isUnreachable: !!token && isServerFault,
        retry: reload
    };
};
