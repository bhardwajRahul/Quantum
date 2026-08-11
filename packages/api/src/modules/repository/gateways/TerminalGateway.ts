import { In } from 'typeorm';
import BaseGateway from '@/shared/gateways/BaseGateway';
import { Channel } from '@/shared/gateways/Channel';
import { OnDisconnect, OnMessage } from '@/shared/gateways/Gateway';
import { Payload, Socket } from '@/shared/gateways/GatewayParams';
import { Middleware } from '@/shared/middlewares/Middleware';
import { NumericParam } from '@/shared/controllers/RequestParams';
import { GatewayError } from '@/shared/errors/GatewayError';
import RuntimeError from '@/shared/errors/RuntimeError';
import { CurrentUser } from '@/modules/auth/middlewares/CurrentUser';
import { SocketAuthenticatedRoute } from '@/modules/auth/middlewares/SocketAuthenticatedRoute';
import { AuthError } from '@/modules/auth/contracts/domain/errors';
import User from '@/modules/user/models/User';
import { UserRole } from '@quantum/contracts/modules/user/domain';
import OrganizationMembership from '@/modules/organization/models/OrganizationMembership';
import Project from '@/modules/project/models/Project';
import { OrganizationRole } from '@quantum/contracts/modules/organization/domain';
import Repository from '../models/Repository';
import RepositoryService from '../services/RepositoryService';
import TerminalSessionService from '../services/TerminalSessionService';
import { RepositoryError } from '../contracts/domain/errors';
import type { GatewaySocket, InboundFrame } from '@/shared/contracts/gateway';
import type { Tenant } from '@/modules/organization/contracts/types/fastify';
import type { TerminalJoined, TerminalResizePayload } from '@quantum/contracts/modules/repository/gateway';
import type { TerminalSession, TerminalSink } from '../services/TerminalSessionService';

@Channel('/repository/:repositoryId/terminal')
@Middleware(SocketAuthenticatedRoute)
export default class TerminalGateway extends BaseGateway{
    readonly #sessions = new WeakMap<GatewaySocket, TerminalSession>();
    readonly #terminal: TerminalSessionService;

    constructor(terminal: TerminalSessionService = new TerminalSessionService()){
        super();
        this.#terminal = terminal;
    }

    @OnMessage('terminal.join')
    async join(
        @CurrentUser() userId: number,
        @Socket() socket: GatewaySocket,
        @NumericParam('repositoryId') repositoryId: number
    ): Promise<TerminalJoined>{
        const repository = await this.#authorize(userId, repositoryId);
        const session = await this.#attach(repository, socket);
        this.#sessions.get(socket)?.destroy();
        this.#sessions.set(socket, session);
        return { repositoryId: repository.id };
    }

    @OnMessage('terminal.input')
    input(@Payload() frame: InboundFrame, @Socket() socket: GatewaySocket): void{
        if(typeof frame.data !== 'string') throw GatewayError.MalformedFrame();
        this.#session(socket).write(frame.data);
    }

    @OnMessage('terminal.resize')
    resize(@Payload() frame: InboundFrame, @Socket() socket: GatewaySocket): void{
        const size = this.#size(frame.data);
        void this.#session(socket).resize(size.cols, size.rows);
    }

    @OnDisconnect()
    disconnect(@Socket() socket: GatewaySocket): void{
        this.#sessions.get(socket)?.destroy();
        this.#sessions.delete(socket);
    }

    async #authorize(userId: number, repositoryId: number): Promise<Repository>{
        return new RepositoryService().getOwned(userId, await this.#tenant(userId), repositoryId);
    }

    async #tenant(userId: number): Promise<Tenant>{
        const user = await User.findOneBy({ id: userId });
        if(!user) throw AuthError.Unauthorized();

        const memberships = await OrganizationMembership.find({ where: { userId } });
        const organizationIds = [...new Set(memberships.map((membership) => membership.organizationId))];
        return {
            organizationId: user.defaultOrganizationId,
            projectId: null,
            role: this.#role(memberships, user.defaultOrganizationId),
            organizationIds,
            projectIds: await this.#projectIds(organizationIds),
            isPlatformAdmin: user.role === UserRole.Admin
        };
    }

    #role(memberships: OrganizationMembership[], organizationId: number | null): OrganizationRole{
        return memberships.find((membership) =>
            membership.organizationId === organizationId && membership.projectId === null
        )?.role ?? OrganizationRole.Member;
    }

    async #projectIds(organizationIds: number[]): Promise<number[]>{
        if(organizationIds.length === 0) return [];
        const projects = await Project.find({ where: { organizationId: In(organizationIds) }, select: { id: true } });
        return projects.map((project) => project.id);
    }

    async #attach(repository: Repository, socket: GatewaySocket): Promise<TerminalSession>{
        try{
            return await this.#terminal.open(repository, this.#sink(socket));
        }catch(error){
            if(error instanceof RuntimeError) throw error;
            throw RepositoryError.OperationFailed();
        }
    }

    #sink(socket: GatewaySocket): TerminalSink{
        return {
            output: (data: string) => this.#push(socket, 'terminal.output', data),
            exit: (code: number) => this.#push(socket, 'terminal.exit', { code })
        };
    }

    #push(socket: GatewaySocket, type: string, data: unknown): void{
        if(socket.readyState !== socket.OPEN) return;
        socket.send(JSON.stringify({ type, data }));
    }

    #session(socket: GatewaySocket): TerminalSession{
        const session = this.#sessions.get(socket);
        if(!session) throw GatewayError.MalformedFrame();
        return session;
    }

    #size(raw: unknown): TerminalResizePayload{
        if(typeof raw !== 'object' || raw === null) throw GatewayError.MalformedFrame();
        const { cols, rows } = raw as { cols: unknown; rows: unknown };
        return { cols: this.#dimension(cols), rows: this.#dimension(rows) };
    }

    #dimension(raw: unknown): number{
        if(typeof raw !== 'number' || !Number.isInteger(raw) || raw <= 0){
            throw GatewayError.MalformedFrame();
        }
        return raw;
    }
}
