export type ResourceAction = 'created' | 'updated' | 'removed';

export interface ResourceChangedFrame{
    entity: string;
    action: ResourceAction;
    organizationId: number;
}

export interface ResourceSubscribed{
    organizationIds: number[];
}

export type ResourceServerFrames = {
    'subscribe': ResourceSubscribed;
    'resource.changed': ResourceChangedFrame;
};
