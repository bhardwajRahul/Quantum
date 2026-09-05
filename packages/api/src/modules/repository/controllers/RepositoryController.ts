import BaseController from '@/shared/controllers/BaseController';
import { Route } from '@/shared/controllers/Route';
import { Status } from '@/shared/controllers/Status';
import { Body, NumericParam } from '@/shared/controllers/RequestParams';
import { Middleware } from '@/shared/middlewares/Middleware';
import { CurrentUser } from '@/modules/auth/middlewares/CurrentUser';
import { Tenant } from '@/modules/organization/middlewares/Tenant';
import { TenantGuard } from '@/modules/organization/middlewares/TenantGuard';
import RepositoryService from '../services/RepositoryService';
import { oneWithContainerStatus } from '../services/withContainerStatus';
import { OwnedRepository, RepositoryOwnershipRoute } from '../middlewares/RepositoryOwnershipRoute';
import Repository from '../models/Repository';
import { repositoryRoutes } from '@quantum/contracts/modules/repository/routes';
import type { CreateRepositoryInput, UpdateRepositoryInput } from '@quantum/contracts/modules/repository/http';

@Middleware(TenantGuard())
export default class RepositoryController extends BaseController{
    #repositories = new RepositoryService();

    @Route(repositoryRoutes.mine)
    mine(@CurrentUser() userId: number){
        return this.#repositories.listMine(userId);
    }

    @Route(repositoryRoutes.create)
    @Status(201)
    create(@CurrentUser() userId: number, @Tenant() tenant: Tenant, @Body() body: CreateRepositoryInput){
        return this.#repositories.create(userId, tenant, body);
    }

    @Route(repositoryRoutes.get)
    @Middleware(RepositoryOwnershipRoute)
    get(@OwnedRepository() repository: Repository){
        return oneWithContainerStatus(repository);
    }

    @Route(repositoryRoutes.update)
    @Middleware(RepositoryOwnershipRoute)
    update(
        @CurrentUser() userId: number,
        @Tenant() tenant: Tenant,
        @OwnedRepository() repository: Repository,
        @Body() body: UpdateRepositoryInput
    ){
        return this.#repositories.update(userId, tenant, repository, body);
    }

    @Route(repositoryRoutes.remove)
    @Middleware(RepositoryOwnershipRoute)
    async remove(@OwnedRepository() repository: Repository){
        await this.#repositories.remove(repository);
    }

    @Route(repositoryRoutes.rollback)
    @Status(202)
    @Middleware(RepositoryOwnershipRoute)
    rollback(
        @CurrentUser() userId: number,
        @OwnedRepository() repository: Repository,
        @NumericParam('deploymentId') deploymentId: number
    ){
        return this.#repositories.rollback(userId, repository, deploymentId);
    }
}
