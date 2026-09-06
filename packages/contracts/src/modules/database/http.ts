import type { DatabaseEngine } from './domain';

export interface CreateDatabaseInput{
    name: string;
    engine: DatabaseEngine;
    version?: string;
}

export interface RestoreDatabaseInput{
    backupId: string;
}

export interface ConnectionStringOutput{
    connectionString: string;
}
