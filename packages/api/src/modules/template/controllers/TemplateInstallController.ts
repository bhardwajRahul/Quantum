import BaseController from '@/shared/controllers/BaseController';
import { Route } from '@/shared/controllers/Route';
import { Body, NumericParam } from '@/shared/controllers/RequestParams';
import { CurrentUser } from '@/modules/auth/middlewares/CurrentUser';
import { Middleware } from '@/shared/middlewares/Middleware';
import { Tenant } from '@/modules/organization/middlewares/Tenant';
import { TenantGuard } from '@/modules/organization/middlewares/TenantGuard';
import TemplateInstallService from '../services/TemplateInstallService';
import { templateInstallRoutes } from '@quantum/contracts/modules/template/routes';
import type { TemplateInstallOperationInput } from '@quantum/contracts/modules/template/http';

@Middleware(TenantGuard())
export default class TemplateInstallController extends BaseController{
    #service = new TemplateInstallService();

    @Route(templateInstallRoutes.listByProject)
    listByProject(@Tenant() tenant: Tenant, @NumericParam('projectId') projectId: number){
        return this.#service.listForProject(tenant, projectId);
    }

    @Route(templateInstallRoutes.get)
    get(@Tenant() tenant: Tenant, @NumericParam('id') id: number){
        return this.#service.get(tenant, id);
    }

    @Route(templateInstallRoutes.operate)
    @Middleware(TenantGuard('deploy'))
    operate(@Tenant() tenant: Tenant, @NumericParam('id') id: number, @Body() body: TemplateInstallOperationInput){
        return this.#service.operate(tenant, id, body.operation);
    }

    @Route(templateInstallRoutes.remove)
    @Middleware(TenantGuard('deploy'))
    async remove(@CurrentUser() userId: number, @Tenant() tenant: Tenant, @NumericParam('id') id: number){
        await this.#service.remove(userId, tenant, id);
    }
}
