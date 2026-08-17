import { call } from '@/shared/api/call';
import { deploymentRoutes } from '@quantum/contracts/modules/deployment/routes';
import type { UpdateDeploymentInput, RepositoryOperationInput } from '@quantum/contracts/modules/deployment/http';

export const deploymentApi = {
    listByRepository: (repositoryId: number) =>
        call(deploymentRoutes.listByRepository, { path: { repositoryId } }),

    environment: (repositoryId: number) =>
        call(deploymentRoutes.environment, { path: { repositoryId } }),

    operate: (repositoryId: number, body: RepositoryOperationInput) =>
        call(deploymentRoutes.operate, { path: { repositoryId }, body }),

    update: (id: number, body: UpdateDeploymentInput) =>
        call(deploymentRoutes.update, { path: { id }, body }),

    remove: (id: number) => call(deploymentRoutes.remove, { path: { id } })
};
