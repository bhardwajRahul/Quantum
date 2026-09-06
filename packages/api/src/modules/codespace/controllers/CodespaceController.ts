import BaseController from '@/shared/controllers/BaseController';
import { Route } from '@/shared/controllers/Route';
import { Status } from '@/shared/controllers/Status';
import { Body, NumericParam } from '@/shared/controllers/RequestParams';
import { Middleware } from '@/shared/middlewares/Middleware';
import { CurrentUser } from '@/modules/auth/middlewares/CurrentUser';
import { Tenant } from '@/modules/organization/middlewares/Tenant';
import { TenantGuard } from '@/modules/organization/middlewares/TenantGuard';
import CodespaceService from '../services/CodespaceService';
import { codespaceRoutes } from '@quantum/contracts/modules/codespace/routes';
import type { CreateCodespaceInput } from '@quantum/contracts/modules/codespace/http';

@Middleware(TenantGuard())
export default class CodespaceController extends BaseController{
    #service = new CodespaceService();

    @Route(codespaceRoutes.listByProject)
    listByProject(@NumericParam('projectId') projectId: number, @Tenant() tenant: Tenant){
        return this.#service.listForProject(tenant, projectId);
    }

    @Route(codespaceRoutes.create)
    @Status(201)
    @Middleware(TenantGuard('deploy'))
    create(
        @CurrentUser() userId: number,
        @NumericParam('projectId') projectId: number,
        @Tenant() tenant: Tenant,
        @Body() body: CreateCodespaceInput
    ){
        return this.#service.create(userId, tenant, projectId, body);
    }

    @Route(codespaceRoutes.access)
    @Middleware(TenantGuard('deploy'))
    access(@NumericParam('id') id: number, @Tenant() tenant: Tenant){
        return this.#service.access(tenant, id);
    }

    @Route(codespaceRoutes.forRepository)
    forRepository(@CurrentUser() userId: number, @NumericParam('repositoryId') repositoryId: number, @Tenant() tenant: Tenant){
        return this.#service.forRepository(userId, tenant, repositoryId);
    }

    @Route(codespaceRoutes.openForRepository)
    @Middleware(TenantGuard('deploy'))
    openForRepository(@CurrentUser() userId: number, @NumericParam('repositoryId') repositoryId: number, @Tenant() tenant: Tenant){
        return this.#service.openForRepository(userId, tenant, repositoryId);
    }

    @Route(codespaceRoutes.forInstall)
    forInstall(@NumericParam('installId') installId: number, @Tenant() tenant: Tenant){
        return this.#service.forInstall(tenant, installId);
    }

    @Route(codespaceRoutes.openForInstall)
    @Middleware(TenantGuard('deploy'))
    openForInstall(@CurrentUser() userId: number, @NumericParam('installId') installId: number, @Tenant() tenant: Tenant){
        return this.#service.openForInstall(userId, tenant, installId);
    }

    @Route(codespaceRoutes.stop)
    @Middleware(TenantGuard('deploy'))
    stop(@NumericParam('id') id: number, @Tenant() tenant: Tenant){
        return this.#service.stop(tenant, id);
    }

    @Route(codespaceRoutes.remove)
    @Middleware(TenantGuard('deploy'))
    async remove(@CurrentUser() userId: number, @NumericParam('id') id: number, @Tenant() tenant: Tenant){
        await this.#service.remove(userId, tenant, id);
    }
}
