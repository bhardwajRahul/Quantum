import type { OrganizationRole } from './domain';

export interface CreateOrganizationInput{
    /**
     * @minLength 1
     * @maxLength 64
     */
    name: string;
}

export interface UpdateOrganizationInput{
    /**
     * @minLength 1
     * @maxLength 64
     */
    name?: string;
}

export interface InviteMemberInput{
    /** @format email */
    email: string;
    role: OrganizationRole;
}

export interface UpdateMemberInput{
    role: OrganizationRole;
}
