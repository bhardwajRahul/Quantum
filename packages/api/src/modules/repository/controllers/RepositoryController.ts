import BaseController from '@/shared/controllers/BaseController';
import { Route } from '@/shared/controllers/Route';
import { Status } from '@/shared/controllers/Status';
import { Body, NumericParam, Param, Query } from '@/shared/controllers/RequestParams';
import { Middleware } from '@/shared/middlewares/Middleware';
import ValidationError from '@/shared/errors/ValidationError';
import { AuthenticatedRoute } from '@/modules/auth/middlewares/AuthenticatedRoute';
import { CurrentUser } from '@/modules/auth/middlewares/CurrentUser';
import { PlatformAdminRoute } from '@/modules/auth/middlewares/PlatformAdminRoute';
import { Tenant } from '@/modules/organization/middlewares/Tenant';
import { TenantRoute } from '@/modules/organization/middlewares/TenantRoute';
import RepositoryService from '../services/RepositoryService';
import RepositoryStorageService from '../services/RepositoryStorageService';
import { OwnedRepository, RepositoryOwnershipRoute } from '../middlewares/RepositoryOwnershipRoute';
import Repository from '../models/Repository';
import { repositoryRoutes } from '@quantum/contracts/modules/repository/routes';
import type { CreateRepositoryInput, RepositoryOperationInput, StorageWriteInput, UpdateRepositoryInput } from '@quantum/contracts/modules/repository/http';

@Middleware(AuthenticatedRoute, TenantRoute)
export default class RepositoryController extends BaseController{
    #repositories = new RepositoryService();
    #storage = new RepositoryStorageService();

    @Route(repositoryRoutes.mine)
    mine(@CurrentUser() userId: number){
        return this.#repositories.listMine(userId);
    }

    @Route(repositoryRoutes.create)
    @Status(201)
    create(@CurrentUser() userId: number, @Tenant() tenant: Tenant, @Body() body: CreateRepositoryInput){
        return this.#repositories.create(userId, tenant, body);
    }

    @Route(repositoryRoutes.listAll)
    @Middleware(PlatformAdminRoute)
    listAll(){
        return this.#repositories.listAll();
    }

    @Route(repositoryRoutes.get)
    @Middleware(RepositoryOwnershipRoute)
    get(@OwnedRepository() repository: Repository){
        return repository;
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

    @Route(repositoryRoutes.operate)
    @Middleware(RepositoryOwnershipRoute)
    operate(@OwnedRepository() repository: Repository, @Body() _body: RepositoryOperationInput){
        return repository;
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

    @Route(repositoryRoutes.storageExplore)
    @Route(repositoryRoutes.storageExploreRoot)
    @Middleware(RepositoryOwnershipRoute)
    storageExplore(@OwnedRepository() repository: Repository, @Param('*') route: string | undefined){
        return this.#storage.explore(repository, route);
    }

    @Route(repositoryRoutes.storageRead)
    @Middleware(RepositoryOwnershipRoute)
    storageRead(@OwnedRepository() repository: Repository, @Query('path') filePath: string | undefined){
        if(filePath === undefined) throw new ValidationError({ path: 'Required' });
        return this.#storage.read(repository, filePath);
    }

    @Route(repositoryRoutes.storageWrite)
    @Middleware(RepositoryOwnershipRoute)
    async storageWrite(@OwnedRepository() repository: Repository, @Body() body: StorageWriteInput){
        await this.#storage.write(repository, body.path, body.content);
    }
}
