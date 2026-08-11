import BaseController from '@/shared/controllers/BaseController';
import { Route } from '@/shared/controllers/Route';
import { Query } from '@/shared/controllers/RequestParams';
import { Middleware } from '@/shared/middlewares/Middleware';
import { AuthenticatedRoute } from '@/modules/auth/middlewares/AuthenticatedRoute';
import { Tenant } from '@/modules/organization/middlewares/Tenant';
import { TenantRoute } from '@/modules/organization/middlewares/TenantRoute';
import AnalyticsService from '../services/AnalyticsService';
import { analyticsRoutes } from '@quantum/contracts/modules/analytics/routes';

@Middleware(AuthenticatedRoute, TenantRoute)
export default class AnalyticsController extends BaseController{
    #service = new AnalyticsService();

    @Route(analyticsRoutes.summary)
    summary(@Tenant() tenant: Tenant, @Query('minutes') minutes: string | undefined){
        return this.#service.summary(tenant, minutes);
    }

    @Route(analyticsRoutes.top)
    top(@Tenant() tenant: Tenant, @Query('minutes') minutes: string | undefined){
        return this.#service.top(tenant, minutes);
    }

    @Route(analyticsRoutes.domains)
    domains(@Tenant() tenant: Tenant, @Query('minutes') minutes: string | undefined){
        return this.#service.domains(tenant, minutes);
    }
}
