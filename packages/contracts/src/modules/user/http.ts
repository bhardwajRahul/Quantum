import type { UserRole } from './domain';

export interface CreateUserInput{
    /**
     * @minLength 8
     * @maxLength 16
     */
    username: string;
    /**
     * @minLength 8
     * @maxLength 32
     */
    fullname: string;
    /** @format email */
    email: string;
    /**
     * @minLength 8
     * @maxLength 16
     */
    password: string;
    role: UserRole;
}

export interface UpdateUserInput{
    /**
     * @minLength 8
     * @maxLength 16
     */
    username?: string;
    /**
     * @minLength 8
     * @maxLength 32
     */
    fullname?: string;
    /** @format email */
    email?: string;
    role?: UserRole;
}
