import { createApi } from '@/shared/api/create-api';
import { projectRoutes } from '@quantum/contracts/modules/project/routes';

export const projectApi = createApi(projectRoutes);
