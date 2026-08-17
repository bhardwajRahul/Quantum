import { call } from '@/shared/api/call';
import { dockerRoutes } from '@quantum/contracts/modules/docker/routes';

export const dockerApi = {
    networkUsage: (query?: { minutes?: number }) => call(dockerRoutes.networkUsage, { query }),
    resourceUsage: (query?: { minutes?: number }) => call(dockerRoutes.resourceUsage, { query })
};
