import BaseController from '@/shared/controllers/BaseController';
import { Route } from '@/shared/controllers/Route';
import { Status } from '@/shared/controllers/Status';
import { Body, NumericParam } from '@/shared/controllers/RequestParams';
import { Middleware } from '@/shared/middlewares/Middleware';
import { CurrentUser } from '@/modules/auth/middlewares/CurrentUser';
import { Tenant } from '@/modules/organization/middlewares/Tenant';
import { TenantGuard } from '@/modules/organization/middlewares/TenantGuard';
import DatabaseService from '../services/DatabaseService';
import { databaseRoutes } from '@quantum/contracts/modules/database/routes';
import type { CreateDatabaseInput, RestoreDatabaseInput } from '@quantum/contracts/modules/database/http';

@Middleware(TenantGuard())
export default class DatabaseController extends BaseController{
    #service = new DatabaseService();

    @Route(databaseRoutes.listByProject)
    list(@NumericParam('projectId') projectId: number, @Tenant() tenant: Tenant){
        return this.#service.listForProject(tenant, projectId);
    }

    @Route(databaseRoutes.create)
    @Status(202)
    @Middleware(TenantGuard('project:write'))
    create(
        @CurrentUser() userId: number,
        @NumericParam('projectId') projectId: number,
        @Tenant() tenant: Tenant,
        @Body() body: CreateDatabaseInput
    ){
        return this.#service.create(userId, tenant, projectId, body);
    }

    @Route(databaseRoutes.remove)
    @Middleware(TenantGuard('deploy'))
    async remove(@CurrentUser() userId: number, @NumericParam('id') id: number, @Tenant() tenant: Tenant){
        await this.#service.remove(userId, tenant, id);
    }

    @Route(databaseRoutes.backup)
    @Status(202)
    @Middleware(TenantGuard('deploy'))
    async backup(@CurrentUser() userId: number, @NumericParam('id') id: number, @Tenant() tenant: Tenant){
        await this.#service.backup(userId, tenant, id);
    }

    @Route(databaseRoutes.restore)
    @Status(202)
    @Middleware(TenantGuard('deploy'))
    async restore(
        @CurrentUser() userId: number,
        @NumericParam('id') id: number,
        @Tenant() tenant: Tenant,
        @Body() body: RestoreDatabaseInput
    ){
        await this.#service.restore(userId, tenant, id, body.backupId);
    }

    @Route(databaseRoutes.connectionString)
    @Middleware(TenantGuard('deploy'))
    connectionString(@NumericParam('id') id: number, @Tenant() tenant: Tenant){
        return this.#service.connectionString(tenant, id);
    }
}
