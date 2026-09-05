import BaseController from '@/shared/controllers/BaseController';
import { Route } from '@/shared/controllers/Route';
import { Status } from '@/shared/controllers/Status';
import { Body, NumericParam } from '@/shared/controllers/RequestParams';
import { Middleware } from '@/shared/middlewares/Middleware';
import { CurrentUser } from '@/modules/auth/middlewares/CurrentUser';
import { Tenant } from '@/modules/organization/middlewares/Tenant';
import { TenantGuard } from '@/modules/organization/middlewares/TenantGuard';
import HealthCheckService from '../services/HealthCheckService';
import { healthCheckRoutes } from '@quantum/contracts/modules/health-check/routes';
import type { CreateHealthCheckInput, UpdateHealthCheckInput } from '@quantum/contracts/modules/health-check/http';

@Middleware(TenantGuard())
export default class HealthCheckController extends BaseController{
    #service = new HealthCheckService();

    @Route(healthCheckRoutes.listByRepository)
    listByRepository(@CurrentUser() userId: number, @NumericParam('repositoryId') repositoryId: number, @Tenant() tenant: Tenant){
        return this.#service.listForRepository(tenant, userId, repositoryId);
    }

    @Route(healthCheckRoutes.create)
    @Status(201)
    @Middleware(TenantGuard('repo:write'))
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
    @Middleware(TenantGuard('repo:write'))
    update(@NumericParam('id') id: number, @Tenant() tenant: Tenant, @Body() body: UpdateHealthCheckInput){
        return this.#service.update(tenant, id, body);
    }

    @Route(healthCheckRoutes.remove)
    @Middleware(TenantGuard('repo:write'))
    async remove(@NumericParam('id') id: number, @Tenant() tenant: Tenant){
        await this.#service.remove(tenant, id);
    }
}
