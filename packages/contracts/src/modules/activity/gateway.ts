import type { ActivityEvent } from './domain';

export interface ActivitySubscribed{
    organizationIds: number[];
}

export interface ActivitySubscribeFrame{
    type: 'subscribe';
    data: Record<string, never>;
}

export interface ActivitySubscribedFrame{
    type: 'subscribe';
    data: ActivitySubscribed;
}

export interface ActivityCreatedFrame{
    type: 'activity.created';
    data: ActivityEvent;
}

export type ActivityClientFrame = ActivitySubscribeFrame;

export type ActivityServerFrame = ActivitySubscribedFrame | ActivityCreatedFrame;

export type ActivityClientFrames = {
    [T in ActivityClientFrame['type']]: Extract<ActivityClientFrame, { type: T }>['data'];
};

export type ActivityServerFrames = {
    [T in ActivityServerFrame['type']]: Extract<ActivityServerFrame, { type: T }>['data'];
};
