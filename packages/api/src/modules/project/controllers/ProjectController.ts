import BaseController from '@/shared/controllers/BaseController';
import { Route } from '@/shared/controllers/Route';
import { Status } from '@/shared/controllers/Status';
import { Body, NumericParam } from '@/shared/controllers/RequestParams';
import { Middleware } from '@/shared/middlewares/Middleware';
import { CurrentUser } from '@/modules/auth/middlewares/CurrentUser';
import { Tenant } from '@/modules/organization/middlewares/Tenant';
import { TenantGuard } from '@/modules/organization/middlewares/TenantGuard';
import ProjectService from '../services/ProjectService';
import { projectRoutes } from '@quantum/contracts/modules/project/routes';
import type { CreateProjectInput, UpdateProjectInput } from '@quantum/contracts/modules/project/http';

@Middleware(TenantGuard())
export default class ProjectController extends BaseController{
    #service = new ProjectService();

    @Route(projectRoutes.listByOrganization)
    list(@NumericParam('orgId') orgId: number, @Tenant() tenant: Tenant){
        return this.#service.listForOrg(tenant, orgId);
    }

    @Route(projectRoutes.create)
    @Status(201)
    @Middleware(TenantGuard('project:write'))
    create(
        @CurrentUser() userId: number,
        @NumericParam('orgId') orgId: number,
        @Tenant() tenant: Tenant,
        @Body() body: CreateProjectInput
    ){
        return this.#service.create(userId, tenant, orgId, body);
    }

    @Route(projectRoutes.update)
    @Middleware(TenantGuard('project:write'))
    update(@NumericParam('id') id: number, @Tenant() tenant: Tenant, @Body() body: UpdateProjectInput){
        return this.#service.update(tenant, id, body);
    }

    @Route(projectRoutes.remove)
    @Middleware(TenantGuard('project:delete'))
    async remove(@NumericParam('id') id: number, @Tenant() tenant: Tenant){
        await this.#service.remove(tenant, id);
    }
}
