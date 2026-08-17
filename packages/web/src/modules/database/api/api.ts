import { call } from '@/shared/api/call';
import { databaseRoutes } from '@quantum/contracts/modules/database/routes';
import type { CreateDatabaseInput, RestoreDatabaseInput } from '@quantum/contracts/modules/database/http';

export const databaseApi = {
    listByProject: (projectId: number) => call(databaseRoutes.listByProject, { path: { projectId } }),

    create: (projectId: number, body: CreateDatabaseInput) =>
        call(databaseRoutes.create, { path: { projectId }, body }),

    get: (id: number) => call(databaseRoutes.get, { path: { id } }),

    remove: (id: number) => call(databaseRoutes.remove, { path: { id } }),

    backup: (id: number) => call(databaseRoutes.backup, { path: { id } }),

    restore: (id: number, body: RestoreDatabaseInput) => call(databaseRoutes.restore, { path: { id }, body }),

    connectionString: (id: number) => call(databaseRoutes.connectionString, { path: { id } })
};
