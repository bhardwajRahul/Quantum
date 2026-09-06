import { createApi } from '@/shared/api/create-api';
import { activityRoutes } from '@quantum/contracts/modules/activity/routes';

export const activityApi = createApi(activityRoutes);
