import BaseGateway from '@/shared/gateways/BaseGateway';
import { Channel } from '@/shared/gateways/Channel';
import { OnDisconnect, OnMessage } from '@/shared/gateways/Gateway';
import { Payload, Socket } from '@/shared/gateways/GatewayParams';
import { Middleware } from '@/shared/middlewares/Middleware';
import { NumericParam } from '@/shared/controllers/RequestParams';
import { CurrentUser } from '@/modules/auth/middlewares/CurrentUser';
import { SocketAuthenticatedRoute } from '@/modules/auth/middlewares/SocketAuthenticatedRoute';
import RuntimeLogService from '@/modules/repository/services/RuntimeLogService';
import TemplateInstallService from '../services/TemplateInstallService';
import { serviceNameOf } from './serviceName';
import type { RuntimeLogStream } from '@/modules/repository/services/RuntimeLogService';
import type { GatewaySocket } from '@/shared/contracts/gateway';

@Channel('/template/install/:installId/logs')
@Middleware(SocketAuthenticatedRoute)
export default class TemplateLogGateway extends BaseGateway{
    readonly #streams = new WeakMap<GatewaySocket, RuntimeLogStream>();
    readonly #logs = new RuntimeLogService();
    readonly #installs = new TemplateInstallService();

    @OnMessage('logs.subscribe')
    async subscribe(
        @CurrentUser() userId: number,
        @Socket() socket: GatewaySocket,
        @NumericParam('installId') installId: number,
        @Payload() payload: unknown
    ): Promise<{ templateInstallId: number; container: string }>{
        const container = await this.#installs.containerForUser(userId, installId, serviceNameOf(payload));

        this.#streams.get(socket)?.stop();
        this.#streams.set(socket, await this.#logs.followContainer(container, {
            line: (line) => this.#push(socket, 'logs.line', { line }),
            end: () => this.#push(socket, 'logs.end', {})
        }));

        return { templateInstallId: installId, container: container.name };
    }

    @OnDisconnect()
    disconnect(@Socket() socket: GatewaySocket): void{
        this.#streams.get(socket)?.stop();
        this.#streams.delete(socket);
    }

    #push(socket: GatewaySocket, type: string, data: unknown): void{
        if(socket.readyState !== socket.OPEN) return;
        socket.send(JSON.stringify({ type, data }));
    }
}
