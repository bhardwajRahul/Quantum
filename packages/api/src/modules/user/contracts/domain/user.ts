import type { UserRole } from '@quantum/contracts/modules/user/domain';

export interface UserFields{
    username: string;
    fullname: string;
    email: string;
    role: UserRole;
    passwordHash: string;
    passwordChangedAt: Date | null;
    defaultOrganizationId: number | null;
}
