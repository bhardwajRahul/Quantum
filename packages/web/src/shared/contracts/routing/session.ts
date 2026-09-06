import type { User } from '@quantum/contracts/modules/user/domain';

export interface Session{
    token: string | null;
    user: User | null;
    isAuthenticated: boolean;
    isLoading: boolean;
    isUnreachable: boolean;
    retry: () => void;
}
