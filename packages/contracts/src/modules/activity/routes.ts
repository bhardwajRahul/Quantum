import { get } from '../../shared/routing';
import type { ActivityEvent } from './domain';

export const activityRoutes = {
    list: get<ActivityEvent[]>('/activity')
};
