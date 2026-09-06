import { del, get, patch, post } from '../../shared/routing';
import type {
    CreateComposeInstallInput,
    InstallTemplateInput,
    TemplateInstallOperationInput,
    UpdateComposeInput,
    UpdateTemplateInstallEnvironmentInput
} from './http';
import type { Template, TemplateInstall, TemplateInstallEnvironment } from './domain';

export const templateRoutes = {
    list: get<Template[]>('/template'),
    install: post<InstallTemplateInput, TemplateInstall>('/template/project/:projectId/install')
};

export const templateInstallRoutes = {
    listByProject: get<TemplateInstall[]>('/template/install/project/:projectId'),
    get: get<TemplateInstall>('/template/install/:id'),
    operate: post<TemplateInstallOperationInput, TemplateInstall>('/template/install/:id/operate'),
    remove: del('/template/install/:id'),
    createCompose: post<CreateComposeInstallInput, TemplateInstall>('/template/install/project/:projectId/compose'),
    updateCompose: patch<UpdateComposeInput, TemplateInstall>('/template/install/:id/compose'),
    redeploy: post<never, TemplateInstall>('/template/install/:id/redeploy'),
    environment: get<TemplateInstallEnvironment>('/template/install/:id/environment'),
    updateEnvironment: patch<UpdateTemplateInstallEnvironmentInput, TemplateInstall>('/template/install/:id/environment')
};
