import BaseController from '@/shared/controllers/BaseController';
import { Route } from '@/shared/controllers/Route';
import { NumericParam, Query } from '@/shared/controllers/RequestParams';
import { Middleware } from '@/shared/middlewares/Middleware';
import { AuthenticatedRoute } from '@/modules/auth/middlewares/AuthenticatedRoute';
import { Tenant } from '@/modules/organization/middlewares/Tenant';
import { TenantRoute } from '@/modules/organization/middlewares/TenantRoute';
import MetricService from '../services/MetricService';
import { metricRoutes } from '@quantum/contracts/modules/metric/routes';

@Middleware(AuthenticatedRoute, TenantRoute)
export default class MetricController extends BaseController{
    #service = new MetricService();

    @Route(metricRoutes.byRepository)
    byRepository(
        @NumericParam('repositoryId') repositoryId: number,
        @Tenant() tenant: Tenant,
        @Query('limit') limit: string | undefined,
        @Query('minutes') minutes: string | undefined
    ){
        return this.#service.byRepository(tenant, repositoryId, limit, minutes);
    }
}
