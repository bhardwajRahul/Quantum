import { del, get, patch, post } from '../../shared/routing';
import type { CreateEnvironmentInput, CreateProjectInput, UpdateEnvironmentInput, UpdateProjectInput } from './http';
import type { Environment, Project } from './domain';

export const projectRoutes = {
    listByOrganization: get<Project[]>('/project/organization/:orgId'),
    create: post<CreateProjectInput, Project>('/project/organization/:orgId'),
    get: get<Project>('/project/:id'),
    update: patch<UpdateProjectInput, Project>('/project/:id'),
    remove: del('/project/:id')
};

export const environmentRoutes = {
    list: get<Environment[]>('/project/:projectId/environment'),
    create: post<CreateEnvironmentInput, Environment>('/project/:projectId/environment'),
    get: get<Environment>('/project/environment/:id'),
    update: patch<UpdateEnvironmentInput, Environment>('/project/environment/:id'),
    remove: del('/project/environment/:id')
};
