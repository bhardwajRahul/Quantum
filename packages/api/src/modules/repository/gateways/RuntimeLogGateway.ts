import BaseGateway from '@/shared/gateways/BaseGateway';
import { Channel } from '@/shared/gateways/Channel';
import { OnDisconnect, OnMessage } from '@/shared/gateways/Gateway';
import { Socket } from '@/shared/gateways/GatewayParams';
import { Middleware } from '@/shared/middlewares/Middleware';
import { NumericParam } from '@/shared/controllers/RequestParams';
import { CurrentUser } from '@/modules/auth/middlewares/CurrentUser';
import { SocketAuthenticatedRoute } from '@/modules/auth/middlewares/SocketAuthenticatedRoute';
import RuntimeLogService from '../services/RuntimeLogService';
import { repositoryTenantOf } from '../services/repositoryTenant';
import RepositoryService from '../services/RepositoryService';
import type { RuntimeLogStream } from '../services/RuntimeLogService';
import type { GatewaySocket } from '@/shared/contracts/gateway';
import type { RuntimeLogsSubscribed } from '@quantum/contracts/modules/repository/logs';

@Channel('/repository/:repositoryId/logs')
@Middleware(SocketAuthenticatedRoute)
export default class RuntimeLogGateway extends BaseGateway{
    readonly #streams = new WeakMap<GatewaySocket, RuntimeLogStream>();
    readonly #logs = new RuntimeLogService();

    @OnMessage('logs.subscribe')
    async subscribe(
        @CurrentUser() userId: number,
        @Socket() socket: GatewaySocket,
        @NumericParam('repositoryId') repositoryId: number
    ): Promise<RuntimeLogsSubscribed>{
        const tenant = await repositoryTenantOf(userId);
        const repository = await new RepositoryService().getOwned(userId, tenant, repositoryId);

        // One stream per socket: a second subscribe replaces the first rather than
        // doubling every line.
        this.#streams.get(socket)?.stop();
        this.#streams.set(socket, await this.#logs.follow(repository, {
            line: (line) => this.#push(socket, 'logs.line', { line }),
            end: () => this.#push(socket, 'logs.end', {})
        }));

        return { repositoryId: repository.id };
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
