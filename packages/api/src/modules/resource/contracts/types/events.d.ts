import type { ResourceAction } from '@quantum/contracts/modules/resource/gateway';

export interface ResourceChangedPayload{
    entity: string;
    action: ResourceAction;
    organizationId: number;
}

declare global{
    interface EventMap{
        'resource.changed': ResourceChangedPayload;
    }
}
