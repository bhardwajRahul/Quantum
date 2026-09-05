import { del, get, patch, post } from '../../shared/routing';
import type { CreateOrganizationInput, InviteMemberInput, UpdateMemberInput, UpdateOrganizationInput } from './http';
import type { Member, Organization, TenantContext } from './domain';

export const organizationRoutes = {
    list: get<Organization[]>('/organization'),
    create: post<CreateOrganizationInput, Organization>('/organization'),
    update: patch<UpdateOrganizationInput, Organization>('/organization/:id'),
    remove: del('/organization/:id'),
    current: get<TenantContext>('/organization/current'),
    members: get<Member[]>('/organization/:orgId/members'),
    invite: post<InviteMemberInput, Member>('/organization/:orgId/members'),
    updateMember: patch<UpdateMemberInput, Member>('/organization/:orgId/members/:id'),
    removeMember: del('/organization/:orgId/members/:id')
};
