import { get } from '../../shared/routing';
import type { PageOf } from '../../shared/http';
import type { ActivityEvent } from './domain';

export const activityRoutes = {
    list: get<PageOf<ActivityEvent>>('/activity')
};
