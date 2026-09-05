import { createApi } from '@/shared/api/create-api';
import { analyticsRoutes } from '@quantum/contracts/modules/analytics/routes';

export const analyticsApi = createApi(analyticsRoutes);
