import { DefineEventGroup, Event } from '@/shared/events/EventGroup';
import ActivityEvent from '../models/ActivityEvent';
import { activityConnections, activityRoom } from '../gateways/ActivityGateway';
import type { ActivityCreatedPayload } from '../contracts/types/events';

@DefineEventGroup('activity')
export default class ActivityEvents{
    @Event('created')
    async created(payload: ActivityCreatedPayload): Promise<void>{
        const activity = await ActivityEvent.findOneBy({ id: payload.activityEventId });
        if(activity === null || activity.organizationId === null) return;

        activityConnections.sendToRoom(activityRoom(activity.organizationId), {
            type: 'activity.created',
            data: activity
        });
    }
}
