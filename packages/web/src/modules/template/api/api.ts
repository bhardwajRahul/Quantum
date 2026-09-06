import { createApi } from '@/shared/api/create-api';
import { templateInstallRoutes, templateRoutes } from '@quantum/contracts/modules/template/routes';

export const templateApi = createApi(templateRoutes);

export const templateInstallApi = createApi(templateInstallRoutes);
