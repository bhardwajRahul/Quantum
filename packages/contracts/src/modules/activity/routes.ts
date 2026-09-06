import { getWithQuery } from '../../shared/routing';
import type { PageOf } from '../../shared/http';
import type { ActivityEvent } from './domain';
import type { ActivityListQuery } from './http';

export const activityRoutes = {
    list: getWithQuery<ActivityListQuery, PageOf<ActivityEvent>>('/activity')
};
