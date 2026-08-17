import { call } from '@/shared/api/call';
import { projectRoutes } from '@quantum/contracts/modules/project/routes';

export const projectApi = {
    listByOrganization: (orgId: number) => call(projectRoutes.listByOrganization, { path: { orgId } })
};
