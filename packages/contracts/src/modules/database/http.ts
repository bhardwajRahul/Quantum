import type { DatabaseEngine } from './domain';

export interface CreateDatabaseInput{
    /**
     * @minLength 1
     */
    name: string;
    engine: DatabaseEngine;
    version?: string;
}

export interface RestoreDatabaseInput{
    /**
     * @minLength 1
     */
    backupId: string;
}

export interface ConnectionStringOutput{
    connectionString: string;
}
