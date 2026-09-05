import BaseController from '@/shared/controllers/BaseController';
import { Route } from '@/shared/controllers/Route';
import { Status } from '@/shared/controllers/Status';
import { Body, NumericParam } from '@/shared/controllers/RequestParams';
import { Middleware } from '@/shared/middlewares/Middleware';
import { Tenant } from '@/modules/organization/middlewares/Tenant';
import { TenantGuard } from '@/modules/organization/middlewares/TenantGuard';
import DomainService from '../services/DomainService';
import { domainRoutes } from '@quantum/contracts/modules/domain/routes';
import type { CreateDomainInput, CreateUpstreamDomainInput, UpdateDomainInput } from '@quantum/contracts/modules/domain/http';

@Middleware(TenantGuard())
export default class DomainController extends BaseController{
    #service = new DomainService();

    @Route(domainRoutes.listByRepository)
    list(@NumericParam('repositoryId') repositoryId: number, @Tenant() tenant: Tenant){
        return this.#service.listForRepository(tenant, repositoryId);
    }

    @Route(domainRoutes.listUpstreams)
    listUpstreams(@Tenant() tenant: Tenant){
        return this.#service.listUpstreams(tenant);
    }

    @Route(domainRoutes.createUpstream)
    @Status(201)
    @Middleware(TenantGuard('repo:write'))
    createUpstream(@Tenant() tenant: Tenant, @Body() body: CreateUpstreamDomainInput){
        return this.#service.createUpstream(tenant, body);
    }

    @Route(domainRoutes.create)
    @Status(201)
    @Middleware(TenantGuard('repo:write'))
    create(@NumericParam('repositoryId') repositoryId: number, @Tenant() tenant: Tenant, @Body() body: CreateDomainInput){
        return this.#service.create(tenant, repositoryId, body);
    }

    @Route(domainRoutes.update)
    @Middleware(TenantGuard('repo:write'))
    update(@NumericParam('id') id: number, @Tenant() tenant: Tenant, @Body() body: UpdateDomainInput){
        return this.#service.update(tenant, id, body);
    }

    @Route(domainRoutes.remove)
    @Middleware(TenantGuard('repo:write'))
    async remove(@NumericParam('id') id: number, @Tenant() tenant: Tenant){
        await this.#service.remove(tenant, id);
    }
}
