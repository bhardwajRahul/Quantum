import { call } from '@/shared/api/call';
import { environmentRoutes, projectRoutes } from '@quantum/contracts/modules/project/routes';
import type {
    CreateEnvironmentInput,
    CreateProjectInput,
    UpdateEnvironmentInput,
    UpdateProjectInput
} from '@quantum/contracts/modules/project/http';

export const projectApi = {
    listByOrganization: (organizationId: number) =>
        call(projectRoutes.listByOrganization, { path: { orgId: organizationId } }),

    create: (organizationId: number, body: CreateProjectInput) =>
        call(projectRoutes.create, { path: { orgId: organizationId }, body }),

    get: (id: number) => call(projectRoutes.get, { path: { id } }),

    update: (id: number, body: UpdateProjectInput) => call(projectRoutes.update, { path: { id }, body }),

    remove: (id: number) => call(projectRoutes.remove, { path: { id } })
};

export const environmentApi = {
    list: (projectId: number) => call(environmentRoutes.list, { path: { projectId } }),

    create: (projectId: number, body: CreateEnvironmentInput) =>
        call(environmentRoutes.create, { path: { projectId }, body }),

    get: (id: number) => call(environmentRoutes.get, { path: { id } }),

    update: (id: number, body: UpdateEnvironmentInput) =>
        call(environmentRoutes.update, { path: { id }, body }),

    remove: (id: number) => call(environmentRoutes.remove, { path: { id } })
};
