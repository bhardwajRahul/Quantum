import BaseController from '@/shared/controllers/BaseController';
import { Route } from '@/shared/controllers/Route';
import { Query } from '@/shared/controllers/RequestParams';
import { Middleware } from '@/shared/middlewares/Middleware';
import { AuthenticatedRoute } from '@/modules/auth/middlewares/AuthenticatedRoute';
import { Tenant } from '@/modules/organization/middlewares/Tenant';
import { TenantRoute } from '@/modules/organization/middlewares/TenantRoute';
import UsageService from '../services/UsageService';
import { dockerRoutes } from '@quantum/contracts/modules/docker/routes';

@Middleware(AuthenticatedRoute, TenantRoute)
export default class UsageController extends BaseController{
    #usage = new UsageService();

    @Route(dockerRoutes.networkUsage)
    networkUsage(@Tenant() tenant: Tenant, @Query('minutes') minutes: string | undefined){
        return this.#usage.network(tenant, minutes);
    }

    @Route(dockerRoutes.resourceUsage)
    resourceUsage(@Tenant() tenant: Tenant, @Query('minutes') minutes: string | undefined){
        return this.#usage.resources(tenant, minutes);
    }
}
