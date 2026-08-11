import BaseController from '@/shared/controllers/BaseController';
import { Route } from '@/shared/controllers/Route';
import { Status } from '@/shared/controllers/Status';
import { Body, NumericParam } from '@/shared/controllers/RequestParams';
import { Middleware } from '@/shared/middlewares/Middleware';
import { AuthenticatedRoute } from '@/modules/auth/middlewares/AuthenticatedRoute';
import { CurrentUser } from '@/modules/auth/middlewares/CurrentUser';
import { RequirePermission } from '@/modules/organization/middlewares/RequirePermission';
import { Tenant } from '@/modules/organization/middlewares/Tenant';
import { TenantRoute } from '@/modules/organization/middlewares/TenantRoute';
import HealthCheckService from '../services/HealthCheckService';
import { healthCheckRoutes } from '@quantum/contracts/modules/health-check/routes';
import type { CreateHealthCheckInput, UpdateHealthCheckInput } from '@quantum/contracts/modules/health-check/http';

@Middleware(AuthenticatedRoute, TenantRoute)
export default class HealthCheckController extends BaseController{
    #service = new HealthCheckService();

    @Route(healthCheckRoutes.listByRepository)
    listByRepository(@CurrentUser() userId: number, @NumericParam('repositoryId') repositoryId: number, @Tenant() tenant: Tenant){
        return this.#service.listForRepository(tenant, userId, repositoryId);
    }

    @Route(healthCheckRoutes.create)
    @Status(201)
    @Middleware(RequirePermission('repo:write'))
    create(
        @CurrentUser() userId: number,
        @NumericParam('repositoryId') repositoryId: number,
        @Tenant() tenant: Tenant,
        @Body() body: CreateHealthCheckInput
    ){
        return this.#service.create(tenant, userId, repositoryId, body);
    }

    @Route(healthCheckRoutes.get)
    get(@NumericParam('id') id: number, @Tenant() tenant: Tenant){
        return this.#service.getOwned(tenant, id);
    }

    @Route(healthCheckRoutes.update)
    @Middleware(RequirePermission('repo:write'))
    update(@NumericParam('id') id: number, @Tenant() tenant: Tenant, @Body() body: UpdateHealthCheckInput){
        return this.#service.update(tenant, id, body);
    }

    @Route(healthCheckRoutes.remove)
    @Middleware(RequirePermission('repo:write'))
    async remove(@NumericParam('id') id: number, @Tenant() tenant: Tenant){
        await this.#service.remove(tenant, id);
    }
}
