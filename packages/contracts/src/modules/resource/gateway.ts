/**
 * Every write to an organization-scoped row is announced on this channel so open
 * clients can drop what they have cached for it. The frame deliberately carries no
 * row: it names what changed, and the client re-reads through the same authorized
 * endpoints it already uses, so the socket never becomes a second way to read data.
 */
export type ResourceAction = 'created' | 'updated' | 'removed';

export interface ResourceChangedFrame{
    /** Entity class name, e.g. `Project`. */
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
