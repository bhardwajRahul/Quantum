import { createApi } from '@/shared/api/create-api';
import { activityRoutes } from '@quantum/contracts/modules/activity/routes';
import type { PageOf } from '@quantum/contracts/shared/http';
import type { ActivityEvent } from '@quantum/contracts/modules/activity/domain';

interface ActivityQuery{
    correlationId?: string;
    minutes?: number;
}

const base = createApi(activityRoutes);

export const activityApi = {
    ...base,

    // The backend always paginates this endpoint (meta is always present), so
    // the client-side unwrap() step always turns the wire array into PageOf —
    // unlike the contract type, which describes the raw `data` field backend
    // tests observe.
    list: (query?: ActivityQuery): Promise<PageOf<ActivityEvent>> =>
        base.list({ query }) as unknown as Promise<PageOf<ActivityEvent>>
};
