import type { OrganizationRole } from './domain';

export interface CreateOrganizationInput{
    name: string;
}

export interface UpdateOrganizationInput{
    name?: string;
}

export interface InviteMemberInput{
    email: string;
    role: OrganizationRole;
}

export interface UpdateMemberInput{
    role: OrganizationRole;
}
