import { getWithQuery } from '../../shared/routing';
import type { AnalyticsSummary, AnalyticsTop, DomainStat } from './domain';
import type { AnalyticsQuery } from './http';

export const analyticsRoutes = {
    summary: getWithQuery<AnalyticsQuery, AnalyticsSummary>('/analytics/summary'),
    top: getWithQuery<AnalyticsQuery, AnalyticsTop>('/analytics/top'),
    domains: getWithQuery<AnalyticsQuery, DomainStat[]>('/analytics/domains')
};
