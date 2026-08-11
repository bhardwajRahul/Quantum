import { del, get, post } from '../../shared/routing';
import type { CreateCodespaceInput, CreatePortBindingInput } from './http';
import type { Codespace, CodespaceAccess, PortBinding } from './domain';

export const codespaceRoutes = {
    listByProject: get<Codespace[]>('/codespace/project/:projectId'),
    create: post<CreateCodespaceInput, Codespace>('/codespace/project/:projectId'),
    access: get<CodespaceAccess>('/codespace/:id/access'),
    get: get<Codespace>('/codespace/:id'),
    remove: del('/codespace/:id')
};

export const portBindingRoutes = {
    myBindings: get<PortBinding[]>('/codespace/port-binding'),
    create: post<CreatePortBindingInput, PortBinding>('/codespace/port-binding'),
    get: get<PortBinding>('/codespace/port-binding/:id'),
    remove: del('/codespace/port-binding/:id')
};
