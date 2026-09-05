import BaseGateway from '@/shared/gateways/BaseGateway';
import { Channel } from '@/shared/gateways/Channel';
import { OnMessage } from '@/shared/gateways/Gateway';
import { Socket } from '@/shared/gateways/GatewayParams';
import ConnectionRegistry from '@/shared/gateways/ConnectionRegistry';
import { Middleware } from '@/shared/middlewares/Middleware';
import { CurrentUser } from '@/modules/auth/middlewares/CurrentUser';
import { SocketAuthenticatedRoute } from '@/modules/auth/middlewares/SocketAuthenticatedRoute';
import OrganizationMembership from '@/modules/organization/models/OrganizationMembership';
import type { GatewaySocket } from '@/shared/contracts/gateway';
import type { ResourceSubscribed } from '@quantum/contracts/modules/resource/gateway';

export const resourceConnections = new ConnectionRegistry();

export const resourceRoom = (organizationId: number): string => `resource:org:${organizationId}`;

/**
 * A socket only ever joins rooms for organizations the caller is a member of, so a
 * change frame cannot reach someone who could not have read the row anyway.
 */
@Channel('/resource/stream')
@Middleware(SocketAuthenticatedRoute)
export default class ResourceGateway extends BaseGateway{
    protected readonly connections = resourceConnections;

    @OnMessage('subscribe')
    async subscribe(@CurrentUser() userId: number, @Socket() socket: GatewaySocket): Promise<ResourceSubscribed>{
        const memberships = await OrganizationMembership.find({ where: { userId } });
        const organizationIds = [...new Set(memberships.map((membership) => membership.organizationId))];
        for(const organizationId of organizationIds){
            this.connections.join(socket, resourceRoom(organizationId));
        }
        return { organizationIds };
    }
}
