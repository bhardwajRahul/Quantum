import { del, get, post } from '../../shared/routing';
import type { InstallTemplateInput } from './http';
import type { Template, TemplateCategory, TemplateInstall } from './domain';

export const templateRoutes = {
    list: get<Template[]>('/template'),
    categories: get<TemplateCategory[]>('/template/category'),
    install: post<InstallTemplateInput, TemplateInstall>('/template/project/:projectId/install')
};

export const templateInstallRoutes = {
    listByProject: get<TemplateInstall[]>('/template/install/project/:projectId'),
    remove: del('/template/install/:id')
};
