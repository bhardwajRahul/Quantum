import type { BaseEntity } from '../../shared/base';

export interface AnalyticsSummary{
    pageviews: number;
    visitors: number;
    bounces: number;
    bounceRate: number;
}

export interface TopEntry{
    key: string;
    value: number;
}

export interface AnalyticsTopUtm{
    source: TopEntry[];
    medium: TopEntry[];
    campaign: TopEntry[];
}

export interface AnalyticsTop{
    hostnames: TopEntry[];
    paths: TopEntry[];
    referrers: TopEntry[];
    countries: TopEntry[];
    devices: TopEntry[];
    browsers: TopEntry[];
    os: TopEntry[];
    utm: AnalyticsTopUtm;
}

export interface DomainStat{
    host: string;
    pageviews: number;
}

export enum AnalyticsDevice{
    Mobile = 'mobile',
    Desktop = 'desktop',
    Tablet = 'tablet',
    Bot = 'bot'
}

export interface AnalyticsEvent extends BaseEntity{
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
    ts: string;
}

export interface AnalyticsRollup extends BaseEntity{
    organizationId: number;
    domainId: number | null;
    host: string | null;
    bucket: string;
    pageviews: number;
    visitors: number;
    bounces: number;
    topPaths: Record<string, number>;
    topReferrers: Record<string, number>;
    countries: Record<string, number>;
    devices: Record<string, number>;
    browsers: Record<string, number>;
    os: Record<string, number>;
}
