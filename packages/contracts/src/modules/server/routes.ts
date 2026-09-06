import { get } from '../../shared/routing';
import type { PublicAddress, ServerHealth } from './domain';

export const serverRoutes = {
    health: get<ServerHealth>('/server/health'),
    publicAddress: get<PublicAddress>('/server/public-address')
};
