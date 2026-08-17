import { call } from '@/shared/api/call';
import { environmentRoutes, projectRoutes } from '@quantum/contracts/modules/project/routes';

export const projectApi = {
    listByOrganization: (orgId: number) => call(projectRoutes.listByOrganization, { path: { orgId } })
};

export const environmentApi = {
    list: (projectId: number) => call(environmentRoutes.list, { path: { projectId } })
};
