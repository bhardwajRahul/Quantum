import { call } from '@/shared/api/call';
import { activityRoutes } from '@quantum/contracts/modules/activity/routes';

interface ActivityQuery{
    correlationId?: string;
    minutes?: number;
}

export const activityApi = {
    list: (query?: ActivityQuery) => call(activityRoutes.list, { query })
};
