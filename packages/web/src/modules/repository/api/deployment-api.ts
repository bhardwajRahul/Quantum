import { createApi } from '@/shared/api/create-api';
import { deploymentRoutes } from '@quantum/contracts/modules/deployment/routes';

export const deploymentApi = createApi(deploymentRoutes);
