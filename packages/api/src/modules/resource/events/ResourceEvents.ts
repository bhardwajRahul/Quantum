import { DefineEventGroup, Event } from '@/shared/events/EventGroup';
import { resourceConnections, resourceRoom } from '../gateways/ResourceGateway';
import type { ResourceChangedPayload } from '../contracts/types/events';

@DefineEventGroup('resource')
export default class ResourceEvents{
    @Event('changed')
    changed(payload: ResourceChangedPayload): void{
        resourceConnections.sendToRoom(resourceRoom(payload.organizationId), {
            type: 'resource.changed',
            data: {
                entity: payload.entity,
                action: payload.action,
                organizationId: payload.organizationId
            }
        });
    }
}
