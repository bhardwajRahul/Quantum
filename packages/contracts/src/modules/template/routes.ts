import { del, get, post } from '../../shared/routing';
import type { CreateTemplateInput, InstallTemplateInput } from './http';
import type { Template, TemplateCategory, TemplateInstall } from './domain';

export const templateRoutes = {
    list: get<Template[]>('/template'),
    categories: get<TemplateCategory[]>('/template/category'),
    create: post<CreateTemplateInput, Template>('/template/organization/:orgId'),
    install: post<InstallTemplateInput, TemplateInstall>('/template/project/:projectId/install'),
    get: get<Template>('/template/:id'),
    remove: del('/template/:id')
};

export const templateInstallRoutes = {
    listByProject: get<TemplateInstall[]>('/template/install/project/:projectId'),
    get: get<TemplateInstall>('/template/install/:id'),
    remove: del('/template/install/:id')
};
