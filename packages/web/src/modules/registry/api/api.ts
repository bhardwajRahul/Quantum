import { createApi } from '@/shared/api/create-api';
import { registryCredentialRoutes } from '@quantum/contracts/modules/registry/routes';

export const registryCredentialApi = createApi(registryCredentialRoutes);
