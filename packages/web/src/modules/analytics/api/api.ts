import { call } from '@/shared/api/call';
import { analyticsRoutes } from '@quantum/contracts/modules/analytics/routes';

interface AnalyticsQuery{
    minutes?: number;
    domainId?: number;
}

export const analyticsApi = {
    summary: (query?: AnalyticsQuery) => call(analyticsRoutes.summary, { query }),
    top: (query?: AnalyticsQuery) => call(analyticsRoutes.top, { query }),
    domains: (query?: AnalyticsQuery) => call(analyticsRoutes.domains, { query })
};
