import BaseController from '@/shared/controllers/BaseController';
import { Route } from '@/shared/controllers/Route';
import { Status } from '@/shared/controllers/Status';
import { Body, NumericParam } from '@/shared/controllers/RequestParams';
import { Middleware } from '@/shared/middlewares/Middleware';
import { AuthenticatedRoute } from '@/modules/auth/middlewares/AuthenticatedRoute';
import { CurrentUser } from '@/modules/auth/middlewares/CurrentUser';
import { RequirePermission } from '@/modules/organization/middlewares/RequirePermission';
import { Tenant } from '@/modules/organization/middlewares/Tenant';
import { TenantRoute } from '@/modules/organization/middlewares/TenantRoute';
import DatabaseService from '../services/DatabaseService';
import { databaseRoutes } from '@quantum/contracts/modules/database/routes';
import type { CreateDatabaseInput, RestoreDatabaseInput } from '@quantum/contracts/modules/database/http';

@Middleware(AuthenticatedRoute, TenantRoute)
export default class DatabaseController extends BaseController{
    #service = new DatabaseService();

    @Route(databaseRoutes.listByProject)
    list(@NumericParam('projectId') projectId: number, @Tenant() tenant: Tenant){
        return this.#service.listForProject(tenant, projectId);
    }

    @Route(databaseRoutes.create)
    @Status(202)
    @Middleware(RequirePermission('project:write'))
    create(
        @CurrentUser() userId: number,
        @NumericParam('projectId') projectId: number,
        @Tenant() tenant: Tenant,
        @Body() body: CreateDatabaseInput
    ){
        return this.#service.create(userId, tenant, projectId, body);
    }

    @Route(databaseRoutes.get)
    get(@NumericParam('id') id: number, @Tenant() tenant: Tenant){
        return this.#service.getOwned(tenant, id);
    }

    @Route(databaseRoutes.remove)
    @Middleware(RequirePermission('deploy'))
    async remove(@CurrentUser() userId: number, @NumericParam('id') id: number, @Tenant() tenant: Tenant){
        await this.#service.remove(userId, tenant, id);
    }

    @Route(databaseRoutes.backup)
    @Status(202)
    @Middleware(RequirePermission('deploy'))
    async backup(@CurrentUser() userId: number, @NumericParam('id') id: number, @Tenant() tenant: Tenant){
        await this.#service.backup(userId, tenant, id);
    }

    @Route(databaseRoutes.restore)
    @Status(202)
    @Middleware(RequirePermission('deploy'))
    async restore(
        @CurrentUser() userId: number,
        @NumericParam('id') id: number,
        @Tenant() tenant: Tenant,
        @Body() body: RestoreDatabaseInput
    ){
        await this.#service.restore(userId, tenant, id, body.backupId);
    }

    @Route(databaseRoutes.connectionString)
    @Middleware(RequirePermission('deploy'))
    connectionString(@NumericParam('id') id: number, @Tenant() tenant: Tenant){
        return this.#service.connectionString(tenant, id);
    }
}
