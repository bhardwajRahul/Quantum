import BaseController from '@/shared/controllers/BaseController';
import { Route } from '@/shared/controllers/Route';
import { Status } from '@/shared/controllers/Status';
import { Body, NumericParam } from '@/shared/controllers/RequestParams';
import { Middleware } from '@/shared/middlewares/Middleware';
import { Tenant } from '@/modules/organization/middlewares/Tenant';
import { TenantGuard } from '@/modules/organization/middlewares/TenantGuard';
import RegistryCredentialService from '../services/RegistryCredentialService';
import { registryCredentialRoutes } from '@quantum/contracts/modules/registry/routes';
import type { CreateRegistryCredentialInput } from '@quantum/contracts/modules/registry/http';

@Middleware(TenantGuard())
export default class RegistryCredentialController extends BaseController{
    #service = new RegistryCredentialService();

    @Route(registryCredentialRoutes.listByOrganization)
    list(@NumericParam('orgId') orgId: number, @Tenant() tenant: Tenant){
        return this.#service.listForOrg(tenant, orgId);
    }

    @Route(registryCredentialRoutes.create)
    @Status(201)
    @Middleware(TenantGuard('registry:manage'))
    create(@NumericParam('orgId') orgId: number, @Tenant() tenant: Tenant, @Body() body: CreateRegistryCredentialInput){
        return this.#service.create(tenant, orgId, body);
    }

    @Route(registryCredentialRoutes.remove)
    @Middleware(TenantGuard('registry:manage'))
    async remove(@NumericParam('id') id: number, @Tenant() tenant: Tenant){
        await this.#service.remove(tenant, id);
    }
}
