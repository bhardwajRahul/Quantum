import BaseController from '@/shared/controllers/BaseController';
import { Route } from '@/shared/controllers/Route';
import { Status } from '@/shared/controllers/Status';
import { Body, NumericParam } from '@/shared/controllers/RequestParams';
import { Middleware } from '@/shared/middlewares/Middleware';
import { CurrentUser } from '@/modules/auth/middlewares/CurrentUser';
import { Tenant } from '@/modules/organization/middlewares/Tenant';
import { TenantGuard } from '@/modules/organization/middlewares/TenantGuard';
import TemplateService from '../services/TemplateService';
import TemplateInstallService from '../services/TemplateInstallService';
import { templateRoutes } from '@quantum/contracts/modules/template/routes';
import type { InstallTemplateInput } from '@quantum/contracts/modules/template/http';

@Middleware(TenantGuard())
export default class TemplateController extends BaseController{
    #templates = new TemplateService();
    #installs = new TemplateInstallService();

    @Route(templateRoutes.list)
    list(@Tenant() tenant: Tenant){
        return this.#templates.list(tenant);
    }

    @Route(templateRoutes.install)
    @Status(201)
    @Middleware(TenantGuard('deploy'))
    install(
        @CurrentUser() userId: number,
        @Tenant() tenant: Tenant,
        @NumericParam('projectId') projectId: number,
        @Body() body: InstallTemplateInput
    ){
        return this.#installs.install(userId, tenant, projectId, body);
    }
}
