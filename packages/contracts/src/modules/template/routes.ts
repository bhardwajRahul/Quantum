import { del, get, post } from '../../shared/routing';
import type { InstallTemplateInput, TemplateInstallOperationInput } from './http';
import type { Template, TemplateInstall } from './domain';

export const templateRoutes = {
    list: get<Template[]>('/template'),
    install: post<InstallTemplateInput, TemplateInstall>('/template/project/:projectId/install')
};

export const templateInstallRoutes = {
    listByProject: get<TemplateInstall[]>('/template/install/project/:projectId'),
    get: get<TemplateInstall>('/template/install/:id'),
    operate: post<TemplateInstallOperationInput, TemplateInstall>('/template/install/:id/operate'),
    remove: del('/template/install/:id')
};
