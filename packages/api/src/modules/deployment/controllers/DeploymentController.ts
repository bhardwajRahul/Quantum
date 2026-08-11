import BaseController from '@/shared/controllers/BaseController';
import { Route } from '@/shared/controllers/Route';
import { Status } from '@/shared/controllers/Status';
import { Body, NumericParam } from '@/shared/controllers/RequestParams';
import { Middleware } from '@/shared/middlewares/Middleware';
import { AuthenticatedRoute } from '@/modules/auth/middlewares/AuthenticatedRoute';
import { CurrentUser } from '@/modules/auth/middlewares/CurrentUser';
import { PlatformAdminRoute } from '@/modules/auth/middlewares/PlatformAdminRoute';
import { Tenant } from '@/modules/organization/middlewares/Tenant';
import { TenantRoute } from '@/modules/organization/middlewares/TenantRoute';
import DeploymentService from '../services/DeploymentService';
import { DeploymentOwnershipRoute, OwnedDeployment } from '../middlewares/DeploymentOwnershipRoute';
import Deployment from '../models/Deployment';
import { deploymentRoutes } from '@quantum/contracts/modules/deployment/routes';
import type { Tenant as TenantContext } from '@/modules/organization/contracts/types/fastify';
import type { UpdateDeploymentInput } from '@quantum/contracts/modules/deployment/http';
import type { RepositoryOperationInput } from '@quantum/contracts/modules/repository/http';
import type { DeploymentAccepted } from '@quantum/contracts/modules/deployment/domain';

@Middleware(AuthenticatedRoute, TenantRoute)
export default class DeploymentController extends BaseController{
    #deployments = new DeploymentService();

    @Route(deploymentRoutes.listByRepository)
    listByRepository(
        @CurrentUser() userId: number,
        @Tenant() tenant: TenantContext,
        @NumericParam('repositoryId') repositoryId: number
    ){
        return this.#deployments.listForRepository(userId, tenant, repositoryId);
    }

    @Route(deploymentRoutes.environment)
    environment(
        @CurrentUser() userId: number,
        @Tenant() tenant: TenantContext,
        @NumericParam('repositoryId') repositoryId: number
    ){
        return this.#deployments.getActiveEnvironment(userId, tenant, repositoryId);
    }

    @Route(deploymentRoutes.operate)
    @Status(202)
    operate(
        @CurrentUser() userId: number,
        @Tenant() tenant: TenantContext,
        @NumericParam('repositoryId') repositoryId: number,
        @Body() body: RepositoryOperationInput
    ): Promise<DeploymentAccepted>{
        return this.#deployments.operation(userId, tenant, repositoryId, body.operation);
    }

    @Route(deploymentRoutes.get)
    @Middleware(DeploymentOwnershipRoute)
    get(@OwnedDeployment() deployment: Deployment){
        return deployment;
    }

    @Route(deploymentRoutes.update)
    @Middleware(DeploymentOwnershipRoute)
    update(@OwnedDeployment() deployment: Deployment, @Body() body: UpdateDeploymentInput){
        return this.#deployments.updateEnvironmentVariables(deployment, body);
    }

    @Route(deploymentRoutes.remove)
    @Middleware(DeploymentOwnershipRoute)
    async remove(@OwnedDeployment() deployment: Deployment){
        await this.#deployments.remove(deployment);
    }

    @Route(deploymentRoutes.listAll)
    @Middleware(PlatformAdminRoute)
    listAll(){
        return this.#deployments.listAll();
    }

    @Route(deploymentRoutes.jobs)
    jobs(@CurrentUser() userId: number, @Tenant() tenant: TenantContext){
        return this.#deployments.listJobs(userId, tenant);
    }
}
