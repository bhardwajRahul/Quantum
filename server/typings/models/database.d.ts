import mongoose, { Document } from 'mongoose';

export type DatabaseEngine = 'postgres' | 'mysql' | 'mariadb' | 'mongodb' | 'redis';

export type DatabaseStatus =
    | 'pending'
    | 'provisioning'
    | 'running'
    | 'stopped'
    | 'error'
    | 'backing-up';

export interface IDatabaseCredentials{
    username: string;
    password: string;
    database: string;
    port: number;
}

export interface IDatabaseBackup{
    id: string;
    path: string;
    sizeBytes: number;
    createdAt: Date;
}

export interface IDatabase extends Document{
    _id: mongoose.Types.ObjectId;
    name: string;
    engine: DatabaseEngine;
    version: string;
    organization: mongoose.Types.ObjectId;
    project?: mongoose.Types.ObjectId;
    environment?: mongoose.Types.ObjectId;
    user?: mongoose.Types.ObjectId;
    nodeId: string;

    container?: mongoose.Types.ObjectId;

    credentialsEnc?: string;

    connectionStringEnc?: string;
    status: DatabaseStatus;
    backups: IDatabaseBackup[];
    createdAt: Date;

    getDecryptedCredentials(): IDatabaseCredentials | null;

    getConnectionString(): string | null;
}
