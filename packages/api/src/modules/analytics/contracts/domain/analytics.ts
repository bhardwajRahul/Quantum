import { AnalyticsDevice } from '@quantum/contracts/modules/analytics/domain';

export interface AnalyticsEventFields{
    organizationId: number;
    domainId: number | null;
    host: string | null;
    path: string | null;
    status: number | null;
    method: string | null;
    referrer: string | null;
    device: AnalyticsDevice | null;
    browser: string | null;
    os: string | null;
    country: string | null;
    utmSource: string | null;
    utmMedium: string | null;
    utmCampaign: string | null;
    durationMs: number | null;
    ts: Date;
    createdAt: Date;
    updatedAt: Date;
}

export interface AnalyticsRollupFields{
    organizationId: number;
    domainId: number | null;
    host: string | null;
    bucket: Date;
    pageviews: number;
    visitors: number;
    bounces: number;
    topPaths: Record<string, number>;
    topReferrers: Record<string, number>;
    countries: Record<string, number>;
    devices: Record<string, number>;
    browsers: Record<string, number>;
    os: Record<string, number>;
    createdAt: Date;
    updatedAt: Date;
}
