import { createApi } from '@/shared/api/create-api';
import { metricRoutes } from '@quantum/contracts/modules/metric/routes';

export const metricApi = createApi(metricRoutes);
