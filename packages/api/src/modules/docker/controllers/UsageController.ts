import BaseController from '@/shared/controllers/BaseController';
import { Route } from '@/shared/controllers/Route';
import { Query } from '@/shared/controllers/RequestParams';
import { Middleware } from '@/shared/middlewares/Middleware';
import { Tenant } from '@/modules/organization/middlewares/Tenant';
import { TenantGuard } from '@/modules/organization/middlewares/TenantGuard';
import UsageService from '../services/UsageService';
import { dockerRoutes } from '@quantum/contracts/modules/docker/routes';
import type { MinutesQuery } from '@quantum/contracts/modules/docker/http';

@Middleware(TenantGuard())
export default class UsageController extends BaseController{
    #usage = new UsageService();

    @Route(dockerRoutes.networkUsage)
    networkUsage(@Tenant() tenant: Tenant, @Query() query: MinutesQuery){
        return this.#usage.network(tenant, query.minutes);
    }

    @Route(dockerRoutes.resourceUsage)
    resourceUsage(@Tenant() tenant: Tenant, @Query() query: MinutesQuery){
        return this.#usage.resources(tenant, query.minutes);
    }
}
