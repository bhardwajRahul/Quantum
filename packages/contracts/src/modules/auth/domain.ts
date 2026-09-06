import type { UserProfile } from '../user/domain';

export interface Session{
    token: string;
    user: UserProfile & { id: number };
}

export interface EmailAvailability{
    exists: boolean;
}
