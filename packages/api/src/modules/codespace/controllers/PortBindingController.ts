import BaseController from '@/shared/controllers/BaseController';
import { Route } from '@/shared/controllers/Route';
import { Status } from '@/shared/controllers/Status';
import { Body, NumericParam } from '@/shared/controllers/RequestParams';
import { Middleware } from '@/shared/middlewares/Middleware';
import { CurrentUser } from '@/modules/auth/middlewares/CurrentUser';
import { Tenant } from '@/modules/organization/middlewares/Tenant';
import { TenantGuard } from '@/modules/organization/middlewares/TenantGuard';
import PortBindingService from '../services/PortBindingService';
import { portBindingRoutes } from '@quantum/contracts/modules/codespace/routes';
import type { CreatePortBindingInput } from '@quantum/contracts/modules/codespace/http';

@Middleware(TenantGuard())
export default class PortBindingController extends BaseController{
    #service = new PortBindingService();

    @Route(portBindingRoutes.myBindings)
    myBindings(@CurrentUser() userId: number, @Tenant() tenant: Tenant){
        return this.#service.listMine(tenant, userId);
    }

    @Route(portBindingRoutes.create)
    @Status(201)
    create(@CurrentUser() userId: number, @Tenant() tenant: Tenant, @Body() body: CreatePortBindingInput){
        return this.#service.create(userId, tenant, body);
    }

    @Route(portBindingRoutes.get)
    get(@CurrentUser() userId: number, @NumericParam('id') id: number, @Tenant() tenant: Tenant){
        return this.#service.getOwned(tenant, userId, id);
    }

    @Route(portBindingRoutes.remove)
    async remove(@CurrentUser() userId: number, @NumericParam('id') id: number, @Tenant() tenant: Tenant){
        await this.#service.remove(tenant, userId, id);
    }
}
