import { get } from '../../shared/routing';
import type { ServerHealth } from './domain';

export const serverRoutes = {
    health: get<ServerHealth>('/server/health'),
    ip: get<string>('/server/ip')
};
