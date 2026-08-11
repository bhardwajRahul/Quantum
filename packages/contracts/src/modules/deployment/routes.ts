import { del, get, patch, post } from '../../shared/routing';
import type { UpdateDeploymentInput } from './http';
import type { RepositoryOperationInput } from '../repository/http';
import type { Deployment, DeploymentAccepted, DeploymentEnvironment, Job } from './domain';

export const deploymentRoutes = {
    listByRepository: get<Deployment[]>('/deployment/repository/:repositoryId'),
    environment: get<DeploymentEnvironment>('/deployment/repository/:repositoryId/environment'),
    operate: post<RepositoryOperationInput, DeploymentAccepted>('/deployment/repository/:repositoryId/operation'),
    get: get<Deployment>('/deployment/:id'),
    update: patch<UpdateDeploymentInput, Deployment>('/deployment/:id'),
    remove: del('/deployment/:id'),
    listAll: get<Deployment[]>('/deployment'),
    jobs: get<Job[]>('/deployment/job')
};
