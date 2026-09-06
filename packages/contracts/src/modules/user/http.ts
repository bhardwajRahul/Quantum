import type { UserRole } from './domain';

export interface CreateUserInput{
    username: string;
    fullname: string;
    email: string;
    password: string;
    role: UserRole;
}

export interface UpdateUserInput{
    username?: string;
    fullname?: string;
    email?: string;
    role?: UserRole;
}
