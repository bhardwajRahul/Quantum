import BaseController from '@/shared/controllers/BaseController';
import { Route } from '@/shared/controllers/Route';
import { Status } from '@/shared/controllers/Status';
import { Body, NumericParam } from '@/shared/controllers/RequestParams';
import { Middleware } from '@/shared/middlewares/Middleware';
import { Tenant } from '@/modules/organization/middlewares/Tenant';
import { TenantGuard } from '@/modules/organization/middlewares/TenantGuard';
import EnvironmentService from '../services/EnvironmentService';
import { environmentRoutes } from '@quantum/contracts/modules/project/routes';
import type { CreateEnvironmentInput } from '@quantum/contracts/modules/project/http';

@Middleware(TenantGuard())
export default class EnvironmentController extends BaseController{
    #service = new EnvironmentService();

    @Route(environmentRoutes.list)
    list(@NumericParam('projectId') projectId: number, @Tenant() tenant: Tenant){
        return this.#service.listForProject(tenant, projectId);
    }

    @Route(environmentRoutes.create)
    @Status(201)
    @Middleware(TenantGuard('project:write'))
    create(@NumericParam('projectId') projectId: number, @Tenant() tenant: Tenant, @Body() body: CreateEnvironmentInput){
        return this.#service.create(tenant, projectId, body);
    }

    @Route(environmentRoutes.remove)
    @Middleware(TenantGuard('project:write'))
    async remove(@NumericParam('id') id: number, @Tenant() tenant: Tenant){
        await this.#service.remove(tenant, id);
    }
}
