import { createApi } from '@/shared/api/create-api';
import { domainRoutes } from '@quantum/contracts/modules/domain/routes';

export const domainApi = createApi(domainRoutes);
