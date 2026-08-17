import { call } from '@/shared/api/call';
import { activityRoutes } from '@quantum/contracts/modules/activity/routes';
import type { PageOf } from '@quantum/contracts/shared/http';
import type { ActivityEvent } from '@quantum/contracts/modules/activity/domain';

interface ActivityQuery{
    correlationId?: string;
    minutes?: number;
}

export const activityApi = {
    // The backend always paginates this endpoint (meta is always present), so
    // the client-side unwrap() step always turns the wire array into PageOf —
    // unlike the contract type, which describes the raw `data` field backend
    // tests observe.
    list: (query?: ActivityQuery): PromiseLike<PageOf<ActivityEvent>> =>
        call(activityRoutes.list, { query }) as unknown as PromiseLike<PageOf<ActivityEvent>>
};
