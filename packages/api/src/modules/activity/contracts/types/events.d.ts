export interface ActivityCreatedPayload{
    activityEventId: number;
    organizationId: number;
}

declare global{
    interface EventMap{
        'activity.created': ActivityCreatedPayload;
    }
}
