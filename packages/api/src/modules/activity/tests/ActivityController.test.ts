import { describe, expect, it } from 'vitest';
import { useApp } from '@tests/harness';
import { request, expectError } from '@tests/request';
import { seed } from '@tests/Seed';
import { activityRoutes } from '@quantum/contracts/modules/activity/routes';
import { ActivityLevel } from '@quantum/contracts/modules/activity/domain';
import { UserRole } from '@quantum/contracts/modules/user/domain';
import ActivityEvent from '../models/ActivityEvent';
import type { DeepPartial } from 'typeorm';

const ctx = useApp();

interface ActivityEnvelope{
    data: ActivityEvent[];
    meta: { total: number; limit: number; offset: number };
}

const envelopeOf = (res: { json: <T>() => T }): ActivityEvent[] => res.json<ActivityEnvelope>().data;

const seedEvent = async (attributes: DeepPartial<ActivityEvent>): Promise<ActivityEvent> => {
    return Object.assign(ActivityEvent.create(), {
        level: ActivityLevel.Info,
        title: 'Created project',
        message: 'POST /project → 201',
        ts: new Date()
    }, attributes).save();
};

describe('activity', () => {
    it('rejects unauthenticated requests', async () => {
        const res = await request(ctx.app, activityRoutes.list);

        expectError(res, 401, 'Authentication::Unauthorized');
    });

    it('lists events scoped to the caller organization', async () => {
        const { user, org } = await seed.orgContext();
        const foreign = await seed.orgContext();
        await seedEvent({ organizationId: org.id, userId: user.id });
        await seedEvent({ organizationId: foreign.org.id, userId: foreign.user.id });

        const res = await request(ctx.app, activityRoutes.list, { as: user.id });

        expect(res.status).toBe(200);
        expect(envelopeOf(res)).toHaveLength(1);
        expect(envelopeOf(res)[0].organizationId).toBe(org.id);
    });

    it('includes personal events without an organization', async () => {
        const { user } = await seed.orgContext();
        await seedEvent({ userId: user.id, organizationId: null, title: 'Signed in' });

        const res = await request(ctx.app, activityRoutes.list, { as: user.id });

        expect(res.status).toBe(200);
        expect(envelopeOf(res)).toHaveLength(1);
        expect(envelopeOf(res)[0].title).toBe('Signed in');
    });

    it('lets a platform admin see every event', async () => {
        const owner = await seed.orgContext();
        const foreign = await seed.orgContext();
        const admin = await seed.user(UserRole.Admin);
        await seedEvent({ organizationId: owner.org.id });
        await seedEvent({ organizationId: foreign.org.id });

        const res = await request(ctx.app, activityRoutes.list, { as: admin.id });

        expect(res.status).toBe(200);
        expect(envelopeOf(res)).toHaveLength(2);
    });

    it('paginates with meta', async () => {
        const { user, org } = await seed.orgContext();
        for(let index = 0; index < 5; index++){
            await seedEvent({
                organizationId: org.id,
                title: `Event ${index}`,
                ts: new Date(Date.now() + index * 1000)
            });
        }

        const first = await request(ctx.app, activityRoutes.list, {
            as: user.id,
            query: { limit: 2 }
        });

        expect(first.status).toBe(200);
        expect(envelopeOf(first)).toHaveLength(2);
        expect(first.json().meta).toEqual({ total: 5, limit: 2, offset: 0 });
        expect(envelopeOf(first)[0].title).toBe('Event 4');

        const second = await request(ctx.app, activityRoutes.list, {
            as: user.id,
            query: { limit: 2, offset: 2 }
        });

        expect(second.status).toBe(200);
        expect(envelopeOf(second)).toHaveLength(2);
        expect(second.json().meta).toEqual({ total: 5, limit: 2, offset: 2 });
        expect(envelopeOf(second)[0].title).toBe('Event 2');
    });

    it('filters by correlationId', async () => {
        const { user, org } = await seed.orgContext();
        await seedEvent({ organizationId: org.id, correlationId: 'deploy-42' });
        await seedEvent({ organizationId: org.id, correlationId: 'deploy-43' });

        const res = await request(ctx.app, activityRoutes.list, {
            as: user.id,
            query: { correlationId: 'deploy-42' }
        });

        expect(res.status).toBe(200);
        expect(envelopeOf(res)).toHaveLength(1);
        expect(envelopeOf(res)[0].correlationId).toBe('deploy-42');
    });
});
