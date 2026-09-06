import { beforeAll, describe, expect, it } from 'vitest';
import { useApp, flushEvents } from '@tests/harness';
import { seed } from '@tests/Seed';
import JWTService from '@/modules/auth/services/JWTService';
import { eventBus } from '@/shared/events/EventBus';
import { ActivityLevel } from '@quantum/contracts/modules/activity/domain';
import ActivityEvent from '../models/ActivityEvent';
import type { GatewaySocket } from '@/shared/contracts/gateway';
import type { DeepPartial } from 'typeorm';

const ctx = useApp();

beforeAll(async () => {
    await ctx.app.ready();
});

const token = (userId: number): string => new JWTService().sign(userId);

const connectStream = (userId: number) =>
    ctx.app.injectWS('/activity/stream', {
        headers: { 'sec-websocket-protocol': token(userId) }
    });

const seedEvent = async (attributes: DeepPartial<ActivityEvent>): Promise<ActivityEvent> => {
    return Object.assign(ActivityEvent.create(), {
        level: ActivityLevel.Info,
        title: 'Created project',
        message: 'POST /project → 201',
        ts: new Date()
    }, attributes).save();
};

interface Inbox{
    next: () => Promise<Record<string, unknown>>;
}

const createInbox = (socket: GatewaySocket): Inbox => {
    const queue: Array<Record<string, unknown>> = [];
    const waiters: Array<(frame: Record<string, unknown>) => void> = [];

    socket.on('message', (raw: Buffer) => {
        const frame = JSON.parse(raw.toString()) as Record<string, unknown>;
        const waiter = waiters.shift();
        if(waiter) waiter(frame);
        else queue.push(frame);
    });

    return {
        next: (): Promise<Record<string, unknown>> => {
            const frame = queue.shift();
            if(frame !== undefined) return Promise.resolve(frame);
            return new Promise((resolve, reject) => {
                const timer = setTimeout(() => reject(new Error('Timed out waiting for a frame')), 2000);
                waiters.push((resolved) => {
                    clearTimeout(timer);
                    resolve(resolved);
                });
            });
        }
    };
};

const subscribe = async (socket: GatewaySocket, inbox: Inbox): Promise<Record<string, unknown>> => {
    socket.send(JSON.stringify({ type: 'subscribe', data: {} }));
    return inbox.next();
};

describe('activity gateway', () => {
    it('rejects upgrades without a token', async () => {
        await expect(ctx.app.injectWS('/activity/stream'))
            .rejects.toThrow('Unexpected server response: 401');
    });

    it('joins the caller organization rooms on subscribe', async () => {
        const { user, org } = await seed.orgContext();

        const socket = await connectStream(user.id);
        const inbox = createInbox(socket);

        expect(await subscribe(socket, inbox)).toEqual({
            type: 'subscribe',
            data: { organizationIds: [org.id] }
        });
        socket.terminate();
    });

    it('broadcasts created events to the organization room only', async () => {
        const { user, org } = await seed.orgContext();
        const foreign = await seed.orgContext();
        const event = await seedEvent({ organizationId: org.id, userId: user.id });
        const foreignEvent = await seedEvent({ organizationId: foreign.org.id, userId: foreign.user.id });

        const socket = await connectStream(user.id);
        const inbox = createInbox(socket);
        await subscribe(socket, inbox);

        eventBus.emit('activity.created', { activityEventId: foreignEvent.id, organizationId: foreign.org.id });
        eventBus.emit('activity.created', { activityEventId: event.id, organizationId: org.id });
        await flushEvents();

        const frame = await inbox.next();
        expect(frame.type).toBe('activity.created');
        expect(frame.data).toMatchObject({ id: event.id, organizationId: org.id, title: event.title });
        socket.terminate();
    });

    it('delivers org events to every subscribed member', async () => {
        const { user, org } = await seed.orgContext();
        const member = await seed.member(org);
        const event = await seedEvent({ organizationId: org.id, userId: user.id });

        const ownerSocket = await connectStream(user.id);
        const memberSocket = await connectStream(member.id);
        const ownerInbox = createInbox(ownerSocket);
        const memberInbox = createInbox(memberSocket);
        await subscribe(ownerSocket, ownerInbox);
        await subscribe(memberSocket, memberInbox);

        eventBus.emit('activity.created', { activityEventId: event.id, organizationId: org.id });
        await flushEvents();

        expect((await ownerInbox.next()).data).toMatchObject({ id: event.id });
        expect((await memberInbox.next()).data).toMatchObject({ id: event.id });
        ownerSocket.terminate();
        memberSocket.terminate();
    });

    it('ignores events recorded without an organization', async () => {
        const { user } = await seed.orgContext();
        const personal = await seedEvent({ organizationId: null, userId: user.id });

        const socket = await connectStream(user.id);
        const inbox = createInbox(socket);
        await subscribe(socket, inbox);

        eventBus.emit('activity.created', { activityEventId: personal.id, organizationId: 0 });
        await flushEvents();

        await expect(inbox.next()).rejects.toThrow('Timed out waiting for a frame');
        socket.terminate();
    });
});
