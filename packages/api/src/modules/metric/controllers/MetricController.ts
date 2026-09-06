import BaseController from '@/shared/controllers/BaseController';
import { Route } from '@/shared/controllers/Route';
import { NumericParam, Query } from '@/shared/controllers/RequestParams';
import { Middleware } from '@/shared/middlewares/Middleware';
import { Tenant } from '@/modules/organization/middlewares/Tenant';
import { TenantGuard } from '@/modules/organization/middlewares/TenantGuard';
import MetricService from '../services/MetricService';
import { metricRoutes } from '@quantum/contracts/modules/metric/routes';
import type { MetricQuery } from '@quantum/contracts/modules/metric/http';

@Middleware(TenantGuard())
export default class MetricController extends BaseController{
    #service = new MetricService();

    @Route(metricRoutes.containers)
    containers(@Tenant() tenant: Tenant){
        return this.#service.containers(tenant);
    }

    @Route(metricRoutes.byContainer)
    byContainer(
        @NumericParam('containerId') containerId: number,
        @Tenant() tenant: Tenant,
        @Query() query: MetricQuery
    ){
        return this.#service.byContainer(tenant, containerId, query.limit, query.minutes);
    }
}
