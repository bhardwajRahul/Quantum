import { del, get, patch, post } from '../../shared/routing';
import type { CreateEnvironmentInput, CreateProjectInput, UpdateProjectInput } from './http';
import type { Environment, Project } from './domain';

export const projectRoutes = {
    listByOrganization: get<Project[]>('/project/organization/:orgId'),
    create: post<CreateProjectInput, Project>('/project/organization/:orgId'),
    update: patch<UpdateProjectInput, Project>('/project/:id'),
    remove: del('/project/:id')
};

export const environmentRoutes = {
    list: get<Environment[]>('/project/:projectId/environment'),
    create: post<CreateEnvironmentInput, Environment>('/project/:projectId/environment'),
    remove: del('/project/environment/:id')
};
