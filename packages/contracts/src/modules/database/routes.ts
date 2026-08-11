import { del, get, post } from '../../shared/routing';
import type { ConnectionStringOutput, CreateDatabaseInput, RestoreDatabaseInput } from './http';
import type { Database } from './domain';

export const databaseRoutes = {
    listByProject: get<Database[]>('/database/project/:projectId'),
    create: post<CreateDatabaseInput, Database>('/database/project/:projectId'),
    get: get<Database>('/database/:id'),
    remove: del('/database/:id'),
    backup: post<never>('/database/:id/backup'),
    restore: post<RestoreDatabaseInput>('/database/:id/restore'),
    connectionString: get<ConnectionStringOutput>('/database/:id/connection-string')
};
