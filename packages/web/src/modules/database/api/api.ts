import { createApi } from '@/shared/api/create-api';
import { databaseRoutes } from '@quantum/contracts/modules/database/routes';

export const databaseApi = createApi(databaseRoutes);
