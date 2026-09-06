import { del, get, patch, post } from '../../shared/routing';
import type { CreateProjectInput, UpdateProjectInput } from './http';
import type { Project } from './domain';

export const projectRoutes = {
    listByOrganization: get<Project[]>('/project/organization/:orgId'),
    create: post<CreateProjectInput, Project>('/project/organization/:orgId'),
    update: patch<UpdateProjectInput, Project>('/project/:id'),
    remove: del('/project/:id')
};
