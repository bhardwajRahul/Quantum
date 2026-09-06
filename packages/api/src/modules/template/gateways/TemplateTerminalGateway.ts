import BaseGateway from '@/shared/gateways/BaseGateway';
import { Channel } from '@/shared/gateways/Channel';
import { OnDisconnect, OnMessage } from '@/shared/gateways/Gateway';
import { Payload, Socket } from '@/shared/gateways/GatewayParams';
import { Middleware } from '@/shared/middlewares/Middleware';
import { NumericParam } from '@/shared/controllers/RequestParams';
import { GatewayError } from '@/shared/errors/GatewayError';
import { CurrentUser } from '@/modules/auth/middlewares/CurrentUser';
import { SocketAuthenticatedRoute } from '@/modules/auth/middlewares/SocketAuthenticatedRoute';
import TerminalSessionService from '@/modules/repository/services/TerminalSessionService';
import TemplateInstallService from '../services/TemplateInstallService';
import { serviceNameOf } from './serviceName';
import type { GatewaySocket } from '@/shared/contracts/gateway';
import type { TerminalResizePayload } from '@quantum/contracts/modules/repository/gateway';
import type { TerminalSession, TerminalSink } from '@/modules/repository/services/TerminalSessionService';

@Channel('/template/install/:installId/terminal')
@Middleware(SocketAuthenticatedRoute)
export default class TemplateTerminalGateway extends BaseGateway{
    readonly #sessions = new WeakMap<GatewaySocket, TerminalSession>();
    readonly #terminal = new TerminalSessionService();
    readonly #installs = new TemplateInstallService();

    @OnMessage('terminal.join')
    async join(
        @CurrentUser() userId: number,
        @Socket() socket: GatewaySocket,
        @NumericParam('installId') installId: number,
        @Payload() payload: unknown
    ): Promise<{ templateInstallId: number; container: string }>{
        const container = await this.#installs.containerForUser(userId, installId, serviceNameOf(payload));
        const session = await this.#terminal.openContainer(container, '/', this.#sink(socket));
        this.#sessions.get(socket)?.destroy();
        this.#sessions.set(socket, session);
        return { templateInstallId: installId, container: container.name };
    }

    @OnMessage('terminal.input')
    input(@Payload() payload: unknown, @Socket() socket: GatewaySocket): void{
        if(typeof payload !== 'string') throw GatewayError.MalformedFrame();
        this.#session(socket).write(payload);
    }

    @OnMessage('terminal.resize')
    resize(@Payload() payload: unknown, @Socket() socket: GatewaySocket): void{
        const size = this.#size(payload);
        void this.#session(socket).resize(size.cols, size.rows);
    }

    @OnDisconnect()
    disconnect(@Socket() socket: GatewaySocket): void{
        this.#sessions.get(socket)?.destroy();
        this.#sessions.delete(socket);
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
        if(!session) throw GatewayError.NotJoined();
        return session;
    }

    #size(raw: unknown): TerminalResizePayload{
        if(typeof raw !== 'object' || raw === null) throw GatewayError.MalformedFrame();
        const { cols, rows } = raw as { cols: unknown; rows: unknown };
        return { cols: this.#dimension(cols), rows: this.#dimension(rows) };
    }

    #dimension(raw: unknown): number{
        if(typeof raw !== 'number' || !Number.isInteger(raw) || raw <= 0) throw GatewayError.MalformedFrame();
        return raw;
    }
}
