import BaseGateway from '@/shared/gateways/BaseGateway';
import { Channel } from '@/shared/gateways/Channel';
import { OnMessage, OnDisconnect } from '@/shared/gateways/Gateway';
import { Payload, Socket } from '@/shared/gateways/GatewayParams';
import { Middleware } from '@/shared/middlewares/Middleware';
import { parseId } from '@/shared/controllers/parseId';
import { eventBus } from '@/shared/events/EventBus';
import { CurrentUser } from '@/modules/auth/middlewares/CurrentUser';
import User from '@/modules/user/models/User';
import Repository from '@/modules/repository/models/Repository';
import OrganizationMembership from '@/modules/organization/models/OrganizationMembership';
import { UserRole } from '@quantum/contracts/modules/user/domain';
import { SocketAuthenticatedRoute } from '@/modules/auth/middlewares/SocketAuthenticatedRoute';
import { DeploymentError } from '../contracts/domain/errors';
import type { GatewaySocket } from '@/shared/contracts/gateway';
import type { DeploymentStatusChangedPayload, DeploymentLogPayload, DeploymentCompletedPayload } from '../contracts/domain/events';

const room = (repositoryId: number): string => `deployment:repo:${repositoryId}`;

@Channel('/deployment/stream')
@Middleware(SocketAuthenticatedRoute)
export default class DeploymentGateway extends BaseGateway{
    #subscriptions = new WeakMap<GatewaySocket, number>();

    constructor(){
        super();
        eventBus.subscribe('deployment.statusChanged', (payload) => this.#status(payload as DeploymentStatusChangedPayload, 'deployment.statusChanged'));
        eventBus.subscribe('deployment.completed', (payload) => this.#status(payload as DeploymentCompletedPayload, 'deployment.completed'));
        eventBus.subscribe('deployment.log', (payload) => this.#log(payload as DeploymentLogPayload));
    }

    @OnMessage('subscribe')
    async subscribe(
        @CurrentUser() userId: number,
        @Payload() payload: { repositoryId?: unknown },
        @Socket() socket: GatewaySocket
    ): Promise<{ repositoryId: number }>{
        const repositoryId = parseId(payload.repositoryId);
        await this.#assertAccess(userId, repositoryId);

        const previous = this.#subscriptions.get(socket);
        if(previous !== undefined) this.connections.leave(socket, room(previous));

        this.#subscriptions.set(socket, repositoryId);
        this.connections.join(socket, room(repositoryId));
        return { repositoryId };
    }

    @OnDisconnect()
    disconnect(@Socket() socket: GatewaySocket){
        this.#subscriptions.delete(socket);
    }

    async #assertAccess(userId: number, repositoryId: number): Promise<void>{
        const repository = await Repository.findOneBy({ id: repositoryId });
        if(!repository) throw DeploymentError.NotFound();

        const user = await User.findOneBy({ id: userId });
        if(user?.role === UserRole.Admin) return;
        if(repository.userId === userId) return;
        if(repository.organizationId !== null){
            const membership = await OrganizationMembership.findOneBy({ userId, organizationId: repository.organizationId });
            if(membership) return;
        }
        throw DeploymentError.Forbidden();
    }

    #status(payload: DeploymentStatusChangedPayload, type: string): void{
        this.connections.sendToRoom(room(payload.repositoryId), {
            type,
            data: { deploymentId: payload.deploymentId, status: payload.status }
        });
    }

    #log(payload: DeploymentLogPayload): void{
        this.connections.sendToRoom(room(payload.repositoryId), {
            type: 'deployment.log',
            data: { deploymentId: payload.deploymentId, line: payload.line }
        });
    }
}
