import { createApi } from '@/shared/api/create-api';
import { codespaceRoutes } from '@quantum/contracts/modules/codespace/routes';

export const codespaceApi = createApi(codespaceRoutes);
