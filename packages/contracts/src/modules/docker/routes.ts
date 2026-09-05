import { get } from '../../shared/routing';
import type { NetworkUsageStat, ResourceUsageStat } from './domain';

export const dockerRoutes = {
    networkUsage: get<NetworkUsageStat[]>('/docker/usage/network'),
    resourceUsage: get<ResourceUsageStat[]>('/docker/usage/resources')
};
