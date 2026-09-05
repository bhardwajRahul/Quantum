import BaseController from '@/shared/controllers/BaseController';
import { Route } from '@/shared/controllers/Route';
import { NumericParam } from '@/shared/controllers/RequestParams';
import { Middleware } from '@/shared/middlewares/Middleware';
import { Tenant } from '@/modules/organization/middlewares/Tenant';
import { TenantGuard } from '@/modules/organization/middlewares/TenantGuard';
import TemplateInstallService from '../services/TemplateInstallService';
import { templateInstallRoutes } from '@quantum/contracts/modules/template/routes';

@Middleware(TenantGuard())
export default class TemplateInstallController extends BaseController{
    #service = new TemplateInstallService();

    @Route(templateInstallRoutes.listByProject)
    listByProject(@Tenant() tenant: Tenant, @NumericParam('projectId') projectId: number){
        return this.#service.listForProject(tenant, projectId);
    }

    @Route(templateInstallRoutes.remove)
    @Middleware(TenantGuard('deploy'))
    async remove(@Tenant() tenant: Tenant, @NumericParam('id') id: number){
        await this.#service.remove(tenant, id);
    }
}
