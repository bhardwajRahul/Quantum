import type { BaseEntity } from '../../shared/base';

export enum OrganizationRole{
    Owner = 'owner',
    Admin = 'admin',
    Member = 'member',
    Viewer = 'viewer'
}

export interface Organization extends BaseEntity{
    name: string;
    slug: string;
    isPersonal: boolean;
    ownerId: number;
}

export interface Member extends BaseEntity{
    userId: number;
    username: string;
    fullname: string;
    email: string;
    role: OrganizationRole;
}

export interface TenantContext{
    organization: Organization;
    role: OrganizationRole;
}
