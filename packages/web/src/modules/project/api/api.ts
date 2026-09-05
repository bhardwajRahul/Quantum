import { createApi } from '@/shared/api/create-api';
import { environmentRoutes, projectRoutes } from '@quantum/contracts/modules/project/routes';

export const projectApi = createApi(projectRoutes);

export const environmentApi = createApi(environmentRoutes);
