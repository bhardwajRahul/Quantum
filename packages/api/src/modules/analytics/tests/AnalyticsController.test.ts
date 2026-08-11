import { describe, expect, it } from 'vitest';
import { useApp } from '@tests/harness';
import { request, expectError } from '@tests/request';
import { seed } from '@tests/Seed';
import { analyticsRoutes } from '@quantum/contracts/modules/analytics/routes';
import { AnalyticsDevice } from '@quantum/contracts/modules/analytics/domain';
import { UserRole } from '@quantum/contracts/modules/user/domain';
import AnalyticsEvent from '../models/AnalyticsEvent';
import AnalyticsRollup from '../models/AnalyticsRollup';
import type { DeepPartial } from 'typeorm';

const ctx = useApp();

const seedRollup = async (attributes: DeepPartial<AnalyticsRollup>): Promise<AnalyticsRollup> => {
    return Object.assign(AnalyticsRollup.create(), {
        host: 'app.test',
        bucket: new Date(),
        pageviews: 10,
        visitors: 5,
        bounces: 1,
        topPaths: {},
        topReferrers: {},
        countries: {},
        devices: {},
        browsers: {},
        os: {}
    }, attributes).save();
};

const seedAnalyticsEvent = async (attributes: DeepPartial<AnalyticsEvent>): Promise<AnalyticsEvent> => {
    return Object.assign(AnalyticsEvent.create(), {
        host: 'app.test',
        path: '/',
        status: 200,
        method: 'GET',
        device: AnalyticsDevice.Desktop,
        ts: new Date()
    }, attributes).save();
};

describe('analytics', () => {
    it('rejects unauthenticated requests', async () => {
        const res = await request(ctx.app, analyticsRoutes.summary);

        expectError(res, 401, 'Authentication::Unauthorized');
    });

    it('summarizes rollups scoped to the caller organization', async () => {
        const { user, org } = await seed.orgContext();
        const foreign = await seed.orgContext();
        await seedRollup({ organizationId: org.id, pageviews: 10, visitors: 5, bounces: 1 });
        await seedRollup({ organizationId: org.id, host: 'alt.test', pageviews: 30, visitors: 5, bounces: 4 });
        await seedRollup({ organizationId: foreign.org.id, pageviews: 999, visitors: 999, bounces: 999 });

        const res = await request(ctx.app, analyticsRoutes.summary, { as: user.id });

        expect(res.status).toBe(200);
        expect(res.data()).toEqual({ pageviews: 40, visitors: 10, bounces: 5, bounceRate: 50 });
    });

    it('returns a zero summary without rollups', async () => {
        const { user } = await seed.orgContext();

        const res = await request(ctx.app, analyticsRoutes.summary, { as: user.id });

        expect(res.status).toBe(200);
        expect(res.data()).toEqual({ pageviews: 0, visitors: 0, bounces: 0, bounceRate: 0 });
    });

    it('aggregates top entries from rollups and events', async () => {
        const { user, org } = await seed.orgContext();
        await seedRollup({
            organizationId: org.id,
            host: 'app.test',
            pageviews: 10,
            topPaths: { '/': 6, '/docs': 4 },
            topReferrers: { 'google.com': 3 },
            countries: { ES: 5 },
            devices: { desktop: 8 },
            browsers: { Chrome: 7 },
            os: { Linux: 9 }
        });
        await seedRollup({
            organizationId: org.id,
            host: 'alt.test',
            pageviews: 2,
            topPaths: { '/': 2 }
        });
        await seedAnalyticsEvent({ organizationId: org.id, utmSource: 'newsletter', utmMedium: 'email', utmCampaign: 'launch' });
        await seedAnalyticsEvent({ organizationId: org.id, utmSource: 'newsletter' });

        const res = await request(ctx.app, analyticsRoutes.top, { as: user.id });

        expect(res.status).toBe(200);
        const top = res.data();
        expect(top.hostnames).toEqual([
            { key: 'app.test', value: 10 },
            { key: 'alt.test', value: 2 }
        ]);
        expect(top.paths).toEqual([
            { key: '/', value: 8 },
            { key: '/docs', value: 4 }
        ]);
        expect(top.referrers).toEqual([{ key: 'google.com', value: 3 }]);
        expect(top.countries).toEqual([{ key: 'ES', value: 5 }]);
        expect(top.devices).toEqual([{ key: 'desktop', value: 8 }]);
        expect(top.browsers).toEqual([{ key: 'Chrome', value: 7 }]);
        expect(top.os).toEqual([{ key: 'Linux', value: 9 }]);
        expect(top.utm.source).toEqual([{ key: 'newsletter', value: 2 }]);
        expect(top.utm.medium).toEqual([{ key: 'email', value: 1 }]);
        expect(top.utm.campaign).toEqual([{ key: 'launch', value: 1 }]);
    });

    it('excludes foreign organizations from top aggregations', async () => {
        const { user, org } = await seed.orgContext();
        const foreign = await seed.orgContext();
        await seedRollup({ organizationId: org.id, pageviews: 1 });
        await seedRollup({ organizationId: foreign.org.id, host: 'foreign.test', pageviews: 50 });
        await seedAnalyticsEvent({ organizationId: foreign.org.id, utmSource: 'foreign' });

        const res = await request(ctx.app, analyticsRoutes.top, { as: user.id });

        expect(res.status).toBe(200);
        expect(res.data().hostnames).toEqual([{ key: 'app.test', value: 1 }]);
        expect(res.data().utm.source).toEqual([]);
    });

    it('derives domain stats from rollups', async () => {
        const { user, org } = await seed.orgContext();
        await seedRollup({ organizationId: org.id, host: 'app.test', pageviews: 10 });
        await seedRollup({ organizationId: org.id, host: 'app.test', pageviews: 7 });
        await seedRollup({ organizationId: org.id, host: 'zeta.test', pageviews: 9 });

        const res = await request(ctx.app, analyticsRoutes.domains, { as: user.id });

        expect(res.status).toBe(200);
        expect(res.data()).toEqual([
            { host: 'app.test', pageviews: 17 },
            { host: 'zeta.test', pageviews: 9 }
        ]);
    });

    it('honors the minutes window', async () => {
        const { user, org } = await seed.orgContext();
        await seedRollup({ organizationId: org.id, pageviews: 4 });
        await seedRollup({
            organizationId: org.id,
            pageviews: 100,
            bucket: new Date(Date.now() - 48 * 60 * 60 * 1000)
        });

        const res = await request(ctx.app, analyticsRoutes.summary, {
            as: user.id,
            query: { minutes: 1440 }
        });

        expect(res.status).toBe(200);
        expect(res.data().pageviews).toBe(4);
    });

    it('lets a platform admin aggregate every organization', async () => {
        const owner = await seed.orgContext();
        const foreign = await seed.orgContext();
        const admin = await seed.user(UserRole.Admin);
        await seedRollup({ organizationId: owner.org.id, pageviews: 1 });
        await seedRollup({ organizationId: foreign.org.id, pageviews: 2 });

        const res = await request(ctx.app, analyticsRoutes.summary, { as: admin.id });

        expect(res.status).toBe(200);
        expect(res.data().pageviews).toBe(3);
    });
});
