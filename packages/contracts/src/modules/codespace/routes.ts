import { del, get, post } from '../../shared/routing';
import type { CreateCodespaceInput } from './http';
import type { Codespace, CodespaceAccess } from './domain';

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
