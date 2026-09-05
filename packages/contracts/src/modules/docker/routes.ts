import { getWithQuery } from '../../shared/routing';
import type { NetworkUsageStat, ResourceUsageStat } from './domain';
import type { MinutesQuery } from './http';

export const dockerRoutes = {
    networkUsage: getWithQuery<MinutesQuery, NetworkUsageStat[]>('/docker/usage/network'),
    resourceUsage: getWithQuery<MinutesQuery, ResourceUsageStat[]>('/docker/usage/resources')
};
