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
import type { ActivitySubscribed } from '@quantum/contracts/modules/activity/gateway';

export const activityConnections = new ConnectionRegistry();

export const activityRoom = (organizationId: number): string => `activity:org:${organizationId}`;

@Channel('/activity/stream')
@Middleware(SocketAuthenticatedRoute)
export default class ActivityGateway extends BaseGateway{
    protected readonly connections = activityConnections;

    @OnMessage('subscribe')
    async subscribe(@CurrentUser() userId: number, @Socket() socket: GatewaySocket): Promise<ActivitySubscribed>{
        const memberships = await OrganizationMembership.find({ where: { userId } });
        const organizationIds = [...new Set(memberships.map((membership) => membership.organizationId))];
        for(const organizationId of organizationIds){
            this.connections.join(socket, activityRoom(organizationId));
        }
        return { organizationIds };
    }
}
