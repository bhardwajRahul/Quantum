import type { BaseEntity } from '../../shared/base';

export enum ActivityLevel{
    Info = 'info',
    Success = 'success',
    Progress = 'progress',
    Warn = 'warn',
    Error = 'error'
}

export interface ActivityEvent extends BaseEntity{
    organizationId: number | null;
    userId: number | null;
    scope: string | null;
    level: ActivityLevel;
    title: string;
    message: string;
    source: string | null;
    correlationId: string | null;
    meta: Record<string, unknown>;
    ts: string;
}
