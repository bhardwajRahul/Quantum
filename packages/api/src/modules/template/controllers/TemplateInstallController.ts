import BaseController from '@/shared/controllers/BaseController';
import { Route } from '@/shared/controllers/Route';
import { Status } from '@/shared/controllers/Status';
import { Body, NumericParam } from '@/shared/controllers/RequestParams';
import { CurrentUser } from '@/modules/auth/middlewares/CurrentUser';
import { Middleware } from '@/shared/middlewares/Middleware';
import { Tenant } from '@/modules/organization/middlewares/Tenant';
import { TenantGuard } from '@/modules/organization/middlewares/TenantGuard';
import TemplateInstallService from '../services/TemplateInstallService';
import { templateInstallRoutes } from '@quantum/contracts/modules/template/routes';
import type {
    CreateComposeInstallInput,
    TemplateInstallOperationInput,
    CreateSourceInstallInput,
    InspectStackSourceInput,
    UpdateComposeInput,
    UpdateStackSourceInput,
    UpdateStackVariablesInput,
    UpdateTemplateInstallEnvironmentInput
} from '@quantum/contracts/modules/template/http';

@Middleware(TenantGuard())
export default class TemplateInstallController extends BaseController{
    #service = new TemplateInstallService();

    @Route(templateInstallRoutes.listByProject)
    listByProject(@Tenant() tenant: Tenant, @NumericParam('projectId') projectId: number){
        return this.#service.listForProject(tenant, projectId);
    }

    @Route(templateInstallRoutes.get)
    async get(@Tenant() tenant: Tenant, @NumericParam('id') id: number){
        return this.#service.present(await this.#service.get(tenant, id));
    }

    @Route(templateInstallRoutes.createCompose)
    @Status(201)
    @Middleware(TenantGuard('deploy'))
    createCompose(
        @CurrentUser() userId: number,
        @Tenant() tenant: Tenant,
        @NumericParam('projectId') projectId: number,
        @Body() body: CreateComposeInstallInput
    ){
        return this.#service.createCompose(userId, tenant, projectId, body);
    }

    @Route(templateInstallRoutes.updateCompose)
    @Middleware(TenantGuard('deploy'))
    updateCompose(@Tenant() tenant: Tenant, @NumericParam('id') id: number, @Body() body: UpdateComposeInput){
        return this.#service.updateCompose(tenant, id, body);
    }

    @Route(templateInstallRoutes.redeploy)
    @Middleware(TenantGuard('deploy'))
    redeploy(@CurrentUser() userId: number, @Tenant() tenant: Tenant, @NumericParam('id') id: number){
        return this.#service.redeploy(userId, tenant, id);
    }

    @Route(templateInstallRoutes.environment)
    environment(@Tenant() tenant: Tenant, @NumericParam('id') id: number){
        return this.#service.environment(tenant, id);
    }

    @Route(templateInstallRoutes.updateEnvironment)
    @Middleware(TenantGuard('deploy'))
    updateEnvironment(@Tenant() tenant: Tenant, @NumericParam('id') id: number, @Body() body: UpdateTemplateInstallEnvironmentInput){
        return this.#service.updateEnvironment(tenant, id, body);
    }

    @Route(templateInstallRoutes.inspectSource)
    inspectSource(@CurrentUser() userId: number, @Body() body: InspectStackSourceInput){
        return this.#service.inspectSource(userId, body);
    }

    @Route(templateInstallRoutes.createFromSource)
    @Status(201)
    @Middleware(TenantGuard('deploy'))
    createFromSource(
        @CurrentUser() userId: number,
        @Tenant() tenant: Tenant,
        @NumericParam('projectId') projectId: number,
        @Body() body: CreateSourceInstallInput
    ){
        return this.#service.createFromSource(userId, tenant, projectId, body);
    }

    @Route(templateInstallRoutes.updateSource)
    @Middleware(TenantGuard('deploy'))
    updateSource(@Tenant() tenant: Tenant, @NumericParam('id') id: number, @Body() body: UpdateStackSourceInput){
        return this.#service.updateSource(tenant, id, body);
    }

    @Route(templateInstallRoutes.variables)
    variables(@Tenant() tenant: Tenant, @NumericParam('id') id: number){
        return this.#service.variables(tenant, id);
    }

    @Route(templateInstallRoutes.updateVariables)
    @Middleware(TenantGuard('deploy'))
    updateVariables(@Tenant() tenant: Tenant, @NumericParam('id') id: number, @Body() body: UpdateStackVariablesInput){
        return this.#service.updateVariables(tenant, id, body);
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
