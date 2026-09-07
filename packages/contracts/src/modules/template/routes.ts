import { del, get, patch, post } from '../../shared/routing';
import type {
    CreateComposeInstallInput,
    CreateSourceInstallInput,
    InspectStackSourceInput,
    InstallTemplateInput,
    TemplateInstallOperationInput,
    UpdateComposeInput,
    UpdateStackSourceInput,
    UpdateStackVariablesInput,
    UpdateTemplateInstallEnvironmentInput,
    UpdateTemplateInstallInput
} from './http';
import type { StackSourceInspection, Template, TemplateInstall, TemplateInstallEnvironment } from './domain';
import type { WebhookOutcome } from '../repository/domain';
import type { ActivityEvent } from '../activity/domain';

export const templateRoutes = {
    list: get<Template[]>('/template'),
    install: post<InstallTemplateInput, TemplateInstall>('/template/project/:projectId/install')
};

export const templateInstallRoutes = {
    listByProject: get<TemplateInstall[]>('/template/install/project/:projectId'),
    get: get<TemplateInstall>('/template/install/:id'),
    update: patch<UpdateTemplateInstallInput, TemplateInstall>('/template/install/:id'),
    operate: post<TemplateInstallOperationInput, TemplateInstall>('/template/install/:id/operate'),
    remove: del('/template/install/:id'),
    createCompose: post<CreateComposeInstallInput, TemplateInstall>('/template/install/project/:projectId/compose'),
    inspectSource: post<InspectStackSourceInput, StackSourceInspection>('/template/source/inspect'),
    createFromSource: post<CreateSourceInstallInput, TemplateInstall>('/template/install/project/:projectId/source'),
    updateSource: patch<UpdateStackSourceInput, TemplateInstall>('/template/install/:id/source'),
    updateCompose: patch<UpdateComposeInput, TemplateInstall>('/template/install/:id/compose'),
    redeploy: post<never, TemplateInstall>('/template/install/:id/redeploy'),
    environment: get<TemplateInstallEnvironment>('/template/install/:id/environment'),
    updateEnvironment: patch<UpdateTemplateInstallEnvironmentInput, TemplateInstall>('/template/install/:id/environment'),
    variables: get<Record<string, string>>('/template/install/:id/variables'),
    updateVariables: patch<UpdateStackVariablesInput, TemplateInstall>('/template/install/:id/variables'),
    githubHook: post<never, WebhookOutcome>('/template/install/:id/github'),
    activity: get<ActivityEvent[]>('/template/install/:id/activity')
};
