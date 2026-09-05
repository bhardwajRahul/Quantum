import BaseController from '@/shared/controllers/BaseController';
import { Route } from '@/shared/controllers/Route';
import { Query } from '@/shared/controllers/RequestParams';
import { Middleware } from '@/shared/middlewares/Middleware';
import { Tenant } from '@/modules/organization/middlewares/Tenant';
import { TenantGuard } from '@/modules/organization/middlewares/TenantGuard';
import AnalyticsService from '../services/AnalyticsService';
import { analyticsRoutes } from '@quantum/contracts/modules/analytics/routes';
import type { AnalyticsQuery } from '@quantum/contracts/modules/analytics/http';

@Middleware(TenantGuard())
export default class AnalyticsController extends BaseController{
    #service = new AnalyticsService();

    @Route(analyticsRoutes.summary)
    summary(@Tenant() tenant: Tenant, @Query() query: AnalyticsQuery){
        return this.#service.summary(tenant, query.minutes, query.domainId);
    }

    @Route(analyticsRoutes.top)
    top(@Tenant() tenant: Tenant, @Query() query: AnalyticsQuery){
        return this.#service.top(tenant, query.minutes, query.domainId);
    }

    @Route(analyticsRoutes.domains)
    domains(@Tenant() tenant: Tenant, @Query() query: AnalyticsQuery){
        return this.#service.domains(tenant, query.minutes, query.domainId);
    }
}
