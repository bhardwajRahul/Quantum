import { ActivityLevel } from '@quantum/contracts/modules/activity/domain';

export interface ActivityEventFields{
    organizationId: number | null;
    userId: number | null;
    scope: string | null;
    level: ActivityLevel;
    title: string;
    message: string;
    source: string | null;
    correlationId: string | null;
    meta: Record<string, unknown>;
    ts: Date;
    createdAt: Date;
    updatedAt: Date;
}
