import { createApi } from '@/shared/api/create-api';
import { organizationRoutes } from '@quantum/contracts/modules/organization/routes';

export const organizationApi = createApi(organizationRoutes);
