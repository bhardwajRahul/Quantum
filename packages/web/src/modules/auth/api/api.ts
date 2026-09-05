import { createApi } from '@/shared/api/create-api';
import { authRoutes } from '@quantum/contracts/modules/auth/routes';

export const authApi = createApi(authRoutes);
