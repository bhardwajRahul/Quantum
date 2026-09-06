import { del, get, post } from '../../shared/routing';
import type { CreateCodespaceInput, CreatePortBindingInput } from './http';
import type { Codespace, CodespaceAccess, PortBinding } from './domain';

export const codespaceRoutes = {
    listByProject: get<Codespace[]>('/codespace/project/:projectId'),
    create: post<CreateCodespaceInput, Codespace>('/codespace/project/:projectId'),
    access: get<CodespaceAccess>('/codespace/:id/access'),
    remove: del('/codespace/:id'),
    forRepository: get<Codespace>('/codespace/repository/:repositoryId'),
    openForRepository: post<never, Codespace>('/codespace/repository/:repositoryId'),
    forInstall: get<Codespace>('/codespace/install/:installId'),
    openForInstall: post<never, Codespace>('/codespace/install/:installId'),
    stop: post<never, Codespace>('/codespace/:id/stop')
};

export const portBindingRoutes = {
    myBindings: get<PortBinding[]>('/codespace/port-binding'),
    create: post<CreatePortBindingInput, PortBinding>('/codespace/port-binding'),
    get: get<PortBinding>('/codespace/port-binding/:id'),
    remove: del('/codespace/port-binding/:id')
};
