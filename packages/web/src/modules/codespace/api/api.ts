import { call } from '@/shared/api/call';
import { codespaceRoutes } from '@quantum/contracts/modules/codespace/routes';
import type { CreateCodespaceInput } from '@quantum/contracts/modules/codespace/http';

export const codespaceApi = {
    listByProject: (projectId: number) => call(codespaceRoutes.listByProject, { path: { projectId } }),

    create: (projectId: number, body: CreateCodespaceInput) =>
        call(codespaceRoutes.create, { path: { projectId }, body }),

    access: (id: number) => call(codespaceRoutes.access, { path: { id } }),

    get: (id: number) => call(codespaceRoutes.get, { path: { id } }),

    remove: (id: number) => call(codespaceRoutes.remove, { path: { id } })
};
