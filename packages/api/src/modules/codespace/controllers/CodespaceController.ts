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
import CodespaceService from '../services/CodespaceService';
import { codespaceRoutes } from '@quantum/contracts/modules/codespace/routes';
import type { CreateCodespaceInput } from '@quantum/contracts/modules/codespace/http';

@Middleware(AuthenticatedRoute, TenantRoute)
export default class CodespaceController extends BaseController{
    #service = new CodespaceService();

    @Route(codespaceRoutes.listByProject)
    listByProject(@NumericParam('projectId') projectId: number, @Tenant() tenant: Tenant){
        return this.#service.listForProject(tenant, projectId);
    }

    @Route(codespaceRoutes.create)
    @Status(201)
    @Middleware(RequirePermission('deploy'))
    create(
        @CurrentUser() userId: number,
        @NumericParam('projectId') projectId: number,
        @Tenant() tenant: Tenant,
        @Body() body: CreateCodespaceInput
    ){
        return this.#service.create(userId, tenant, projectId, body);
    }

    @Route(codespaceRoutes.access)
    @Middleware(RequirePermission('deploy'))
    access(@NumericParam('id') id: number, @Tenant() tenant: Tenant){
        return this.#service.access(tenant, id);
    }

    @Route(codespaceRoutes.remove)
    @Middleware(RequirePermission('deploy'))
    async remove(@CurrentUser() userId: number, @NumericParam('id') id: number, @Tenant() tenant: Tenant){
        await this.#service.remove(userId, tenant, id);
    }
}
