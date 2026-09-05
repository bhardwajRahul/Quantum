import { createApi } from '@/shared/api/create-api';
import { githubRoutes } from '@quantum/contracts/modules/github/routes';

export const githubApi = createApi(githubRoutes);
