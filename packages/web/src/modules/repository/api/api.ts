import { createApi } from '@/shared/api/create-api';
import { repositoryRoutes } from '@quantum/contracts/modules/repository/routes';

export const repositoryApi = createApi(repositoryRoutes);
