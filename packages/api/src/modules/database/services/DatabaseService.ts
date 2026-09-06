import { randomBytes } from 'node:crypto';
import { v4 } from 'uuid';
import { eventBus } from '@/shared/events/EventBus';
import { saveOrConflict } from '@/shared/models/isUniqueViolation';
import { assertOrg, assertProject } from '@/shared/tenancy';
import SecretCipher from '@/shared/services/SecretCipher';
import Project from '@/modules/project/models/Project';
import Database from '../models/Database';
import { DatabaseError } from '../contracts/domain/errors';
import { DatabaseEngine, DatabaseStatus } from '@quantum/contracts/modules/database/domain';
import type { DatabaseCredentials } from '@quantum/contracts/modules/database/domain';
import type { Tenant } from '@/modules/organization/contracts/types/fastify';
import type { ConnectionStringOutput, CreateDatabaseInput } from '@quantum/contracts/modules/database/http';
import type { ProvisionAction } from '../contracts/domain/events';

interface EngineSpec{
    defaultVersion: string;
    defaultPort: number;
}

const ENGINE_SPECS: Record<DatabaseEngine, EngineSpec> = {
    [DatabaseEngine.Postgres]: { defaultVersion: '16-alpine', defaultPort: 5432 },
    [DatabaseEngine.Mysql]: { defaultVersion: '8', defaultPort: 3306 },
    [DatabaseEngine.Mariadb]: { defaultVersion: '11', defaultPort: 3306 },
    [DatabaseEngine.Mongodb]: { defaultVersion: '7', defaultPort: 27017 },
    [DatabaseEngine.Redis]: { defaultVersion: '7-alpine', defaultPort: 6379 }
};

export default class DatabaseService{
    #cipher = new SecretCipher();

    async listForProject(tenant: Tenant, projectId: number): Promise<Database[]>{
        const project = await this.#resolveProject(tenant, projectId);
        return Database.find({ where: { projectId: project.id }, order: { id: 'ASC' } });
    }

    async create(userId: number, tenant: Tenant, projectId: number, input: CreateDatabaseInput): Promise<Database>{
        const project = await this.#resolveProject(tenant, projectId);
        const name = input.name.trim();
        const credentials = this.generateCredentials(input.engine);
        const connectionString = this.buildConnectionString(input.engine, credentials, this.#containerName(input.engine, name));

        const database = await saveOrConflict(Database.create({
            name,
            engine: input.engine,
            version: input.version ?? ENGINE_SPECS[input.engine].defaultVersion,
            organizationId: project.organizationId,
            projectId: project.id,
            userId,
            nodeId: 'local',
            status: DatabaseStatus.Pending,
            credentialsEnc: this.#cipher.encrypt(JSON.stringify(credentials)),
            connectionStringEnc: this.#cipher.encrypt(connectionString),
            backups: []
        }).save(), DatabaseError.NameAlreadyTaken);

        this.#requestProvision(database.id, 'create', userId);
        return database;
    }

    async getOwned(tenant: Tenant, databaseId: number): Promise<Database>{
        const database = await Database.findOneBy({ id: databaseId });
        if(!database) throw DatabaseError.NotFound();
        assertProject(tenant, database.projectId, DatabaseError.Forbidden);
        return database;
    }

    async backup(userId: number, tenant: Tenant, databaseId: number): Promise<void>{
        const database = await this.getOwned(tenant, databaseId);
        this.#requestProvision(database.id, 'backup', userId);
    }

    async restore(userId: number, tenant: Tenant, databaseId: number, backupId: string): Promise<void>{
        const database = await this.getOwned(tenant, databaseId);
        this.#requestProvision(database.id, 'restore', userId, backupId);
    }

    async connectionString(tenant: Tenant, databaseId: number): Promise<ConnectionStringOutput>{
        const database = await this.getOwned(tenant, databaseId);
        if(database.connectionStringEnc === null) throw DatabaseError.NotFound('ConnectionString');
        return { connectionString: this.#cipher.decrypt(database.connectionStringEnc) };
    }

    async remove(userId: number, tenant: Tenant, databaseId: number): Promise<void>{
        const database = await this.getOwned(tenant, databaseId);
        const { id: removedId, containerId } = database;
        await database.remove();
        this.#requestProvision(removedId, 'delete', userId, undefined, containerId);
    }

    generateCredentials(engine: DatabaseEngine): DatabaseCredentials{
        return {
            username: `qdb_${randomBytes(4).toString('hex')}`,
            password: randomBytes(24).toString('base64url'),
            database: `${engine}_${randomBytes(4).toString('hex')}`,
            port: ENGINE_SPECS[engine].defaultPort
        };
    }

    buildConnectionString(engine: DatabaseEngine, credentials: DatabaseCredentials, host: string): string{
        const { username, password, database, port } = credentials;
        switch(engine){
            case DatabaseEngine.Postgres:
                return `postgresql://${username}:${password}@${host}:${port}/${database}`;
            case DatabaseEngine.Mysql:
            case DatabaseEngine.Mariadb:
                return `mysql://${username}:${password}@${host}:${port}/${database}`;
            case DatabaseEngine.Mongodb:
                return `mongodb://${username}:${password}@${host}:${port}/${database}?authSource=admin`;
            case DatabaseEngine.Redis:
                return `redis://:${password}@${host}:${port}`;
        }
    }

    async #resolveProject(tenant: Tenant, projectId: number): Promise<Project>{
        const project = await Project.findOneBy({ id: projectId });
        if(!project) throw DatabaseError.NotFound('Project');
        assertOrg(tenant, project.organizationId, () => DatabaseError.Forbidden('Project'));
        return project;
    }

    #requestProvision(
        databaseId: number,
        action: ProvisionAction,
        userId: number,
        backupId?: string,
        containerId?: number | null
    ): void{
        eventBus.emit('database.provisionRequested', { databaseId, action, userId, backupId, containerId });
    }

    #containerName(engine: DatabaseEngine, name: string): string{
        return `${engine}-${name}-${v4().slice(0, 4)}`.toLowerCase().replace(/[^a-z0-9_.-]/g, '-');
    }
}
