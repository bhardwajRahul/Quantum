import Fastify from 'fastify';
import websocket from '@fastify/websocket';
import { beforeAll, describe, expect, it, vi } from 'vitest';
import { useApp } from '@tests/harness';
import { request } from '@tests/request';
import { seed } from '@tests/Seed';
import JWTService from '@/modules/auth/services/JWTService';
import { repositoryRoutes } from '@quantum/contracts/modules/repository/routes';
import { UserRole } from '@quantum/contracts/modules/user/domain';
import TerminalGateway from '../gateways/TerminalGateway';
import TerminalSessionService from '../services/TerminalSessionService';
import Repository from '../models/Repository';
import type { GatewaySocket } from '@/shared/contracts/gateway';
import type { TerminalSession, TerminalSink } from '../services/TerminalSessionService';
import type { FastifyInstance } from 'fastify';

const ctx = useApp();

beforeAll(async () => {
    await ctx.app.ready();
});

const token = (userId: number): string => new JWTService().sign(userId);

const connectTerminal = (app: FastifyInstance, repositoryId: number, userId: number) =>
    app.injectWS(`/repository/${repositoryId}/terminal`, {
        headers: { 'sec-websocket-protocol': token(userId) }
    });

const createRepository = async (userId: number, projectId: number): Promise<number> => {
    const res = await request(ctx.app, repositoryRoutes.create, {
        as: userId,
        body: { name: 'My App', url: 'https://github.com/acme/my-app', projectId }
    });
    expect(res.status).toBe(201);
    return res.data().id;
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

const send = (socket: GatewaySocket, type: string, data: unknown): void => {
    socket.send(JSON.stringify({ type, data }));
};

describe('terminal gateway', () => {
    it('rejects upgrades without a token', async () => {
        await expect(ctx.app.injectWS('/repository/1/terminal'))
            .rejects.toThrow('Unexpected server response: 401');
    });

    it('rejects upgrades with an invalid token', async () => {
        await expect(ctx.app.injectWS('/repository/1/terminal', {
            headers: { 'sec-websocket-protocol': 'not-a-jwt' }
        })).rejects.toThrow('Unexpected server response: 401');
    });

    it('accepts the token passed as a query fallback', async () => {
        const { user, project } = await seed.orgContext();
        const repositoryId = await createRepository(user.id, project.id);

        const socket = await ctx.app.injectWS(`/repository/${repositoryId}/terminal?token=${token(user.id)}`);
        const inbox = createInbox(socket);
        send(socket, 'terminal.join', {});

        expect(await inbox.next()).toEqual({ error: 'Repository::NotFound' });
        socket.terminate();
    });

    it('denies terminals on repositories the caller cannot access', async () => {
        const owner = await seed.orgContext();
        const stranger = await seed.orgContext();
        const repositoryId = await createRepository(owner.user.id, owner.project.id);

        const socket = await connectTerminal(ctx.app, repositoryId, stranger.user.id);
        const inbox = createInbox(socket);
        send(socket, 'terminal.join', {});

        expect(await inbox.next()).toEqual({ error: 'Repository::Forbidden' });
        socket.terminate();
    });

    it('reports a missing container to the owner instead of reaching docker', async () => {
        const { user, project } = await seed.orgContext();
        const repositoryId = await createRepository(user.id, project.id);

        const socket = await connectTerminal(ctx.app, repositoryId, user.id);
        const inbox = createInbox(socket);
        send(socket, 'terminal.join', {});

        expect(await inbox.next()).toEqual({ error: 'Repository::NotFound' });
        socket.terminate();
    });

    it('lets a platform admin join a foreign repository', async () => {
        const owner = await seed.orgContext();
        const admin = await seed.user(UserRole.Admin);
        const repositoryId = await createRepository(owner.user.id, owner.project.id);

        const socket = await connectTerminal(ctx.app, repositoryId, admin.id);
        const inbox = createInbox(socket);
        send(socket, 'terminal.join', {});

        expect(await inbox.next()).toEqual({ error: 'Repository::NotFound' });
        socket.terminate();
    });

    it('rejects malformed frames', async () => {
        const { user, project } = await seed.orgContext();
        const repositoryId = await createRepository(user.id, project.id);

        const socket = await connectTerminal(ctx.app, repositoryId, user.id);
        const inbox = createInbox(socket);

        socket.send('not-json');
        expect(await inbox.next()).toEqual({ error: 'Gateway::MalformedFrame' });

        send(socket, 'terminal.input', 42);
        expect(await inbox.next()).toEqual({ error: 'Gateway::MalformedFrame' });

        send(socket, 'terminal.resize', { cols: -1, rows: 0 });
        expect(await inbox.next()).toEqual({ error: 'Gateway::MalformedFrame' });

        socket.terminate();
    });

    it('pipes frames between the client and the terminal session', async () => {
        const { user, project } = await seed.orgContext();
        const repositoryId = await createRepository(user.id, project.id);

        const stub = new StubTerminalSessions();
        const app = Fastify();
        await app.register(websocket);
        new TerminalGateway(stub).register(app);
        await app.ready();

        const socket = await connectTerminal(app, repositoryId, user.id);
        const inbox = createInbox(socket);

        send(socket, 'terminal.join', {});
        expect(await inbox.next()).toEqual({ type: 'terminal.join', data: { repositoryId } });

        send(socket, 'terminal.input', 'ls -la\r');
        await vi.waitFor(() => expect(stub.written).toEqual(['ls -la\r']));

        stub.sink?.output('hello world');
        expect(await inbox.next()).toEqual({ type: 'terminal.output', data: 'hello world' });

        send(socket, 'terminal.resize', { cols: 120, rows: 40 });
        await vi.waitFor(() => expect(stub.resizes).toEqual([{ cols: 120, rows: 40 }]));

        stub.sink?.exit(0);
        expect(await inbox.next()).toEqual({ type: 'terminal.exit', data: { code: 0 } });

        socket.terminate();
        await vi.waitFor(() => expect(stub.destroyed).toBe(true));
        await app.close();
    });
});

class StubTerminalSessions extends TerminalSessionService{
    written: string[] = [];
    resizes: Array<{ cols: number; rows: number }> = [];
    destroyed = false;
    sink: TerminalSink | undefined;

    async open(repository: Repository, sink: TerminalSink): Promise<TerminalSession>{
        void repository;
        this.sink = sink;
        return {
            write: (data: string) => {
                this.written.push(data);
            },
            resize: async (cols: number, rows: number) => {
                this.resizes.push({ cols, rows });
            },
            destroy: () => {
                this.destroyed = true;
            }
        };
    }
}
