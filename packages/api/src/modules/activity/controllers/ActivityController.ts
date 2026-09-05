import BaseController from '@/shared/controllers/BaseController';
import { Route } from '@/shared/controllers/Route';
import { Pagination, Query } from '@/shared/controllers/RequestParams';
import { Middleware } from '@/shared/middlewares/Middleware';
import { CurrentUser } from '@/modules/auth/middlewares/CurrentUser';
import { Tenant } from '@/modules/organization/middlewares/Tenant';
import { TenantGuard } from '@/modules/organization/middlewares/TenantGuard';
import ActivityService from '../services/ActivityService';
import { activityRoutes } from '@quantum/contracts/modules/activity/routes';
import type { Page } from '@/shared/contracts/params';
import type { ActivityListQuery } from '@quantum/contracts/modules/activity/http';

@Middleware(TenantGuard())
export default class ActivityController extends BaseController{
    #service = new ActivityService();

    @Route(activityRoutes.list)
    list(
        @CurrentUser() userId: number,
        @Tenant() tenant: Tenant,
        @Pagination({ defaultLimit: 100, maxLimit: 500 }) page: Page,
        @Query() query: ActivityListQuery
    ){
        return this.#service.list(userId, tenant, page, query.correlationId, query.minutes);
    }
}
