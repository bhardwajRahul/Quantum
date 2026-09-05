import BaseController from '@/shared/controllers/BaseController';
import { Route } from '@/shared/controllers/Route';
import { Status } from '@/shared/controllers/Status';
import { Body, NumericParam } from '@/shared/controllers/RequestParams';
import { Middleware } from '@/shared/middlewares/Middleware';
import { AuthenticatedRoute } from '@/modules/auth/middlewares/AuthenticatedRoute';
import { CurrentUser } from '@/modules/auth/middlewares/CurrentUser';
import { RequirePermission } from '../middlewares/RequirePermission';
import { Tenant } from '../middlewares/Tenant';
import { TenantRoute } from '../middlewares/TenantRoute';
import OrganizationService from '../services/OrganizationService';
import { TenancyError } from '../contracts/domain/errors';
import { organizationRoutes } from '@quantum/contracts/modules/organization/routes';
import type { CreateOrganizationInput, UpdateOrganizationInput } from '@quantum/contracts/modules/organization/http';

@Middleware(AuthenticatedRoute, TenantRoute)
export default class OrganizationController extends BaseController{
    #service = new OrganizationService();

    @Route(organizationRoutes.list)
    list(@Tenant() tenant: Tenant){
        return this.#service.listForTenant(tenant);
    }

    @Route(organizationRoutes.create)
    @Status(201)
    create(@CurrentUser() userId: number, @Body() body: CreateOrganizationInput){
        return this.#service.create(userId, body);
    }

    @Route(organizationRoutes.current)
    current(@CurrentUser() userId: number, @Tenant() tenant: Tenant){
        return this.#service.currentFor(userId, tenant);
    }

    @Route(organizationRoutes.update)
    @Middleware(RequirePermission('org:settings'))
    update(@NumericParam('id') id: number, @Tenant() tenant: Tenant, @Body() body: UpdateOrganizationInput){
        this.#assertMembership(id, tenant);
        return this.#service.update(id, body);
    }

    @Route(organizationRoutes.remove)
    @Middleware(RequirePermission('org:delete'))
    async remove(@NumericParam('id') id: number, @Tenant() tenant: Tenant){
        this.#assertMembership(id, tenant);
        await this.#service.remove(id);
    }

    #assertMembership(orgId: number, tenant: Tenant){
        if(tenant.isPlatformAdmin || tenant.organizationIds.includes(orgId)) return;
        throw TenancyError.OrganizationNotFound();
    }
}
