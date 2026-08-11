import BaseController from '@/shared/controllers/BaseController';
import { Route } from '@/shared/controllers/Route';
import { Status } from '@/shared/controllers/Status';
import { Body, NumericParam } from '@/shared/controllers/RequestParams';
import { Middleware } from '@/shared/middlewares/Middleware';
import { AuthenticatedRoute } from '@/modules/auth/middlewares/AuthenticatedRoute';
import { RequirePermission } from '@/modules/organization/middlewares/RequirePermission';
import { Tenant } from '@/modules/organization/middlewares/Tenant';
import { TenantRoute } from '@/modules/organization/middlewares/TenantRoute';
import DomainService from '../services/DomainService';
import { domainRoutes } from '@quantum/contracts/modules/domain/routes';
import type { CreateDomainInput, UpdateDomainInput } from '@quantum/contracts/modules/domain/http';

@Middleware(AuthenticatedRoute, TenantRoute)
export default class DomainController extends BaseController{
    #service = new DomainService();

    @Route(domainRoutes.listByRepository)
    list(@NumericParam('repositoryId') repositoryId: number, @Tenant() tenant: Tenant){
        return this.#service.listForRepository(tenant, repositoryId);
    }

    @Route(domainRoutes.create)
    @Status(201)
    @Middleware(RequirePermission('repo:write'))
    create(@NumericParam('repositoryId') repositoryId: number, @Tenant() tenant: Tenant, @Body() body: CreateDomainInput){
        return this.#service.create(tenant, repositoryId, body);
    }

    @Route(domainRoutes.get)
    get(@NumericParam('id') id: number, @Tenant() tenant: Tenant){
        return this.#service.getOwned(tenant, id);
    }

    @Route(domainRoutes.update)
    @Middleware(RequirePermission('repo:write'))
    update(@NumericParam('id') id: number, @Tenant() tenant: Tenant, @Body() body: UpdateDomainInput){
        return this.#service.update(tenant, id, body);
    }

    @Route(domainRoutes.remove)
    @Middleware(RequirePermission('repo:write'))
    async remove(@NumericParam('id') id: number, @Tenant() tenant: Tenant){
        await this.#service.remove(tenant, id);
    }
}
