import type { BaseEntity } from '../../shared/base';

export enum UserRole{
    User = 'user',
    Admin = 'admin'
}

export interface UserProfile{
    username: string;
    fullname: string;
    email: string;
    role: UserRole;
}

export interface User extends UserProfile, BaseEntity{}
