import { createApi } from '@/shared/api/create-api';
import { dockerRoutes } from '@quantum/contracts/modules/docker/routes';

export const dockerApi = createApi(dockerRoutes);
