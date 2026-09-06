import type { BaseEntity } from '../../shared/base';

export enum DatabaseEngine{
    Postgres = 'postgres',
    Mysql = 'mysql',
    Mariadb = 'mariadb',
    Mongodb = 'mongodb',
    Redis = 'redis'
}

export enum DatabaseStatus{
    Pending = 'pending',
    Provisioning = 'provisioning',
    Running = 'running',
    Stopped = 'stopped',
    Error = 'error',
    BackingUp = 'backing-up'
}

export interface DatabaseCredentials{
    username: string;
    password: string;
    database: string;
    port: number;
}

export interface DatabaseBackup{
    id: string;
    path: string;
    sizeBytes: number;
    createdAt: string;
}

export interface Database extends BaseEntity{
    name: string;
    engine: DatabaseEngine;
    version: string | null;
    organizationId: number;
    projectId: number;
    environmentId: number | null;
    userId: number | null;
    nodeId: string;
    status: DatabaseStatus;
    containerId: number | null;
    backups: DatabaseBackup[];
}
