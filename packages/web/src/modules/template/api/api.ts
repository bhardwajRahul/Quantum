import { call } from '@/shared/api/call';
import { templateInstallRoutes, templateRoutes } from '@quantum/contracts/modules/template/routes';
import type { InstallTemplateInput } from '@quantum/contracts/modules/template/http';

export const templateApi = {
    list: () => call(templateRoutes.list),

    categories: () => call(templateRoutes.categories),

    get: (id: number) => call(templateRoutes.get, { path: { id } }),

    remove: (id: number) => call(templateRoutes.remove, { path: { id } }),

    install: (projectId: number, body: InstallTemplateInput) =>
        call(templateRoutes.install, { path: { projectId }, body })
};

export const templateInstallApi = {
    listByProject: (projectId: number) => call(templateInstallRoutes.listByProject, { path: { projectId } }),

    get: (id: number) => call(templateInstallRoutes.get, { path: { id } }),

    remove: (id: number) => call(templateInstallRoutes.remove, { path: { id } })
};
