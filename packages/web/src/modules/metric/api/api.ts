import { call } from '@/shared/api/call';
import { metricRoutes } from '@quantum/contracts/modules/metric/routes';

export const metricApi = {
    byRepository: (repositoryId: number, query?: { limit?: number; minutes?: number }) =>
        call(metricRoutes.byRepository, { path: { repositoryId }, query })
};
