import BaseController from '@/shared/controllers/BaseController';
import { Route } from '@/shared/controllers/Route';
import { Status } from '@/shared/controllers/Status';
import { Body, NumericParam } from '@/shared/controllers/RequestParams';
import { Middleware } from '@/shared/middlewares/Middleware';
import { TenantGuard } from '../middlewares/TenantGuard';
import MembershipService from '../services/MembershipService';
import { organizationRoutes } from '@quantum/contracts/modules/organization/routes';
import type { InviteMemberInput, UpdateMemberInput } from '@quantum/contracts/modules/organization/http';

@Middleware(TenantGuard())
export default class MembershipController extends BaseController{
    #service = new MembershipService();

    @Route(organizationRoutes.members)
    list(@NumericParam('orgId') orgId: number){
        return this.#service.listMembers(orgId);
    }

    @Route(organizationRoutes.invite)
    @Status(201)
    @Middleware(TenantGuard('member:manage'))
    invite(@NumericParam('orgId') orgId: number, @Body() body: InviteMemberInput){
        return this.#service.invite(orgId, body);
    }

    @Route(organizationRoutes.updateMember)
    @Middleware(TenantGuard('member:manage'))
    updateMember(
        @NumericParam('orgId') orgId: number,
        @NumericParam('id') id: number,
        @Body() body: UpdateMemberInput
    ){
        return this.#service.updateRole(orgId, id, body);
    }

    @Route(organizationRoutes.removeMember)
    @Middleware(TenantGuard('member:manage'))
    async removeMember(@NumericParam('orgId') orgId: number, @NumericParam('id') id: number){
        await this.#service.remove(orgId, id);
    }
}
