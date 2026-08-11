import BaseController from '@/shared/controllers/BaseController';
import { Route } from '@/shared/controllers/Route';
import { Pagination, Query } from '@/shared/controllers/RequestParams';
import { Middleware } from '@/shared/middlewares/Middleware';
import { AuthenticatedRoute } from '@/modules/auth/middlewares/AuthenticatedRoute';
import { CurrentUser } from '@/modules/auth/middlewares/CurrentUser';
import { Tenant } from '@/modules/organization/middlewares/Tenant';
import { TenantRoute } from '@/modules/organization/middlewares/TenantRoute';
import ActivityService from '../services/ActivityService';
import { activityRoutes } from '@quantum/contracts/modules/activity/routes';
import type { Page } from '@/shared/contracts/params';

@Middleware(AuthenticatedRoute, TenantRoute)
export default class ActivityController extends BaseController{
    #service = new ActivityService();

    @Route(activityRoutes.list)
    list(
        @CurrentUser() userId: number,
        @Tenant() tenant: Tenant,
        @Pagination({ defaultLimit: 100, maxLimit: 500 }) page: Page,
        @Query('correlationId') correlationId: string | undefined,
        @Query('minutes') minutes: string | undefined
    ){
        return this.#service.list(userId, tenant, page, correlationId, minutes);
    }
}
