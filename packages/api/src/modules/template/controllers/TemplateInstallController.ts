import BaseController from '@/shared/controllers/BaseController';
import { Route } from '@/shared/controllers/Route';
import { NumericParam } from '@/shared/controllers/RequestParams';
import { Middleware } from '@/shared/middlewares/Middleware';
import { AuthenticatedRoute } from '@/modules/auth/middlewares/AuthenticatedRoute';
import { RequirePermission } from '@/modules/organization/middlewares/RequirePermission';
import { Tenant } from '@/modules/organization/middlewares/Tenant';
import { TenantRoute } from '@/modules/organization/middlewares/TenantRoute';
import TemplateInstallService from '../services/TemplateInstallService';
import { templateInstallRoutes } from '@quantum/contracts/modules/template/routes';

@Middleware(AuthenticatedRoute, TenantRoute)
export default class TemplateInstallController extends BaseController{
    #service = new TemplateInstallService();

    @Route(templateInstallRoutes.listByProject)
    listByProject(@Tenant() tenant: Tenant, @NumericParam('projectId') projectId: number){
        return this.#service.listForProject(tenant, projectId);
    }

    @Route(templateInstallRoutes.remove)
    @Middleware(RequirePermission('deploy'))
    async remove(@Tenant() tenant: Tenant, @NumericParam('id') id: number){
        await this.#service.remove(tenant, id);
    }
}
