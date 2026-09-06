import type { ActivityEvent } from './domain';

export interface ActivitySubscribed{
    organizationIds: number[];
}

export type ActivityServerFrames = {
    'subscribe': ActivitySubscribed;
    'activity.created': ActivityEvent;
};
