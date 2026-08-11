import { call } from '@/shared/api/call';
import { organizationRoutes } from '@quantum/contracts/modules/organization/routes';
import type {
    CreateOrganizationInput,
    InviteMemberInput,
    UpdateMemberInput,
    UpdateOrganizationInput
} from '@quantum/contracts/modules/organization/http';

export const organizationApi = {
    list: () => call(organizationRoutes.list),

    create: (body: CreateOrganizationInput) => call(organizationRoutes.create, { body }),

    get: (id: number) => call(organizationRoutes.get, { path: { id } }),

    update: (id: number, body: UpdateOrganizationInput) => call(organizationRoutes.update, { path: { id }, body }),

    remove: (id: number) => call(organizationRoutes.remove, { path: { id } }),

    current: () => call(organizationRoutes.current),

    members: (orgId: number) => call(organizationRoutes.members, { path: { orgId } }),

    invite: (orgId: number, body: InviteMemberInput) => call(organizationRoutes.invite, { path: { orgId }, body }),

    updateMember: (orgId: number, id: number, body: UpdateMemberInput) =>
        call(organizationRoutes.updateMember, { path: { orgId, id }, body }),

    removeMember: (orgId: number, id: number) => call(organizationRoutes.removeMember, { path: { orgId, id } })
};
