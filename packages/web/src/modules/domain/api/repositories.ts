import { call } from '@/shared/api/call';
import { repositoryRoutes } from '@quantum/contracts/modules/repository/routes';

export const repositoryApi = {
    mine: () => call(repositoryRoutes.mine)
};
