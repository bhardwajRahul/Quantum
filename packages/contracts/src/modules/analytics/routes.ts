import { get } from '../../shared/routing';
import type { AnalyticsSummary, AnalyticsTop, DomainStat } from './domain';

export const analyticsRoutes = {
    summary: get<AnalyticsSummary>('/analytics/summary'),
    top: get<AnalyticsTop>('/analytics/top'),
    domains: get<DomainStat[]>('/analytics/domains')
};
