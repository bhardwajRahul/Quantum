import { randomBytes } from 'node:crypto';
import Database from '@/modules/database/models/Database';
import DatabaseService from '@/modules/database/services/DatabaseService';
import DockerContainer from '@/modules/docker/models/DockerContainer';
import DockerImage from '@/modules/docker/models/DockerImage';
import DockerNetwork from '@/modules/docker/models/DockerNetwork';
import PortBinding from '@/modules/docker/models/PortBinding';
import ActivityStepContext from '@/modules/activity/services/ActivityStepContext';
import SecretCipher from '@/shared/services/SecretCipher';
import ContainerOps from '../ContainerOps';
import { materializeNetwork, teardownNetwork } from '../NetworkOps';
import { allocateHostPort } from '../PortAllocator';
import { getContainerStoragePath, getSystemDockerName } from '../paths';
import { failureMessage } from '../failureMessage';
import { publicHost } from '../publicHost';
import { DatabaseEngine, DatabaseStatus } from '@quantum/contracts/modules/database/domain';
import { NetworkDriver, PortBindingProtocol } from '@quantum/contracts/modules/docker/domain';
import { JobType } from '@quantum/contracts/modules/deployment/domain';
import { logger } from '@/shared/utils/Logger';
import type { DatabaseBackup, DatabaseCredentials } from '@quantum/contracts/modules/database/domain';
import type Job from '../../models/Job';

const BACKUP_DIR = '/quantum-backups';

const READY_ATTEMPTS = 60;
const READY_INTERVAL_MS = 2_000;

interface EngineRuntime{
    image: string;
    dataDir: string;
    backupExtension: string;
    env: (credentials: DatabaseCredentials) => Record<string, string>;
    cmd?: (credentials: DatabaseCredentials) => string[];
    ready: (credentials: DatabaseCredentials) => string;
    dump: (credentials: DatabaseCredentials, file: string) => string;
    restore: (credentials: DatabaseCredentials, file: string) => string;
    restartsOnRestore?: boolean;
}

const RUNTIMES: Record<DatabaseEngine, EngineRuntime> = {
    [DatabaseEngine.Postgres]: {
        image: 'postgres',
        dataDir: '/var/lib/postgresql/data',
        backupExtension: 'dump',
        env: (c) => ({ POSTGRES_USER: c.username, POSTGRES_PASSWORD: c.password, POSTGRES_DB: c.database }),
        ready: (c) => `pg_isready -h 127.0.0.1 -U '${c.username}' -d '${c.database}'`,
        dump: (c, file) => `PGPASSWORD='${c.password}' pg_dump -h 127.0.0.1 -U '${c.username}' -d '${c.database}' -F c -f '${file}'`,
        restore: (c, file) => `PGPASSWORD='${c.password}' pg_restore -h 127.0.0.1 -U '${c.username}' -d '${c.database}' --clean --if-exists '${file}'`
    },
    [DatabaseEngine.Mysql]: {
        image: 'mysql',
        dataDir: '/var/lib/mysql',
        backupExtension: 'sql',
        env: (c) => ({ MYSQL_ROOT_PASSWORD: c.password, MYSQL_USER: c.username, MYSQL_PASSWORD: c.password, MYSQL_DATABASE: c.database }),
        ready: (c) => `mysqladmin ping -h127.0.0.1 -uroot -p'${c.password}' --silent`,
        dump: (c, file) => `mysqldump -h127.0.0.1 -uroot -p'${c.password}' '${c.database}' > '${file}'`,
        restore: (c, file) => `mysql -h127.0.0.1 -uroot -p'${c.password}' '${c.database}' < '${file}'`
    },
    [DatabaseEngine.Mariadb]: {
        image: 'mariadb',
        dataDir: '/var/lib/mysql',
        backupExtension: 'sql',
        env: (c) => ({ MARIADB_ROOT_PASSWORD: c.password, MARIADB_USER: c.username, MARIADB_PASSWORD: c.password, MARIADB_DATABASE: c.database }),
        ready: (c) => `mariadb-admin ping -h127.0.0.1 -uroot -p'${c.password}' --silent`,
        dump: (c, file) => `mariadb-dump -h127.0.0.1 -uroot -p'${c.password}' '${c.database}' > '${file}'`,
        restore: (c, file) => `mariadb -h127.0.0.1 -uroot -p'${c.password}' '${c.database}' < '${file}'`
    },
    [DatabaseEngine.Mongodb]: {
        image: 'mongo',
        dataDir: '/data/db',
        backupExtension: 'archive',
        env: (c) => ({ MONGO_INITDB_ROOT_USERNAME: c.username, MONGO_INITDB_ROOT_PASSWORD: c.password, MONGO_INITDB_DATABASE: c.database }),
        ready: (c) => `mongosh --quiet --username '${c.username}' --password '${c.password}' --authenticationDatabase admin --eval 'db.runCommand({ ping: 1 }).ok' | grep -q 1`,
        dump: (c, file) => `mongodump --username '${c.username}' --password '${c.password}' --authenticationDatabase admin --db '${c.database}' --archive='${file}'`,
        restore: (c, file) => `mongorestore --username '${c.username}' --password '${c.password}' --authenticationDatabase admin --drop --archive='${file}'`
    },
    [DatabaseEngine.Redis]: {
        image: 'redis',
        dataDir: '/data',
        backupExtension: 'rdb',
        env: () => ({}),
        cmd: (c) => ['redis-server', '--requirepass', c.password],
        ready: (c) => `redis-cli -a '${c.password}' --no-auth-warning ping | grep -q PONG`,
        dump: (c, file) => `redis-cli -a '${c.password}' --no-auth-warning --rdb '${file}'`,
        restore: (c, file) => [
            `redis-cli -a '${c.password}' --no-auth-warning CONFIG SET save ''`,
            `cp '${file}' /data/dump.rdb`,
            `redis-cli -a '${c.password}' --no-auth-warning SHUTDOWN NOSAVE || true`
        ].join(' && '),
        restartsOnRestore: true
    }
};

const sleep = (ms: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms));

export default class DatabaseHandler{
    #cipher = new SecretCipher();

    async run(job: Job): Promise<void>{
        if(job.type === JobType.DbDelete){
            await this.#delete(job);
            return;
        }

        const databaseId = job.payload.databaseId as number | undefined;
        if(databaseId === undefined) throw new Error('Database::Job::MissingDatabaseId');

        const database = await Database.findOneBy({ id: databaseId });
        if(!database) throw new Error(`Database::Job::NotFound::${databaseId}`);

        switch(job.type){
            case JobType.DbProvision:
                await this.#provision(job, database);
                return;
            case JobType.DbBackup:
                await this.#backup(job, database);
                return;
            case JobType.DbRestore: {
                const backupId = job.payload.backupId as string | undefined;
                if(!backupId) throw new Error('Database::Job::Restore::MissingBackupId');
                await this.#restore(job, database, backupId);
                return;
            }
            default:
                throw new Error(`Database::Job::UnknownType::${job.type}`);
        }
    }

    #activity(job: Job, database: Database): ActivityStepContext{
        return new ActivityStepContext({
            organizationId: database.organizationId,
            userId: job.userId ?? database.userId,
            scope: 'database',
            source: 'orchestrator.database',
            correlationId: String(job.id)
        });
    }

    #credentials(database: Database): DatabaseCredentials{
        if(database.credentialsEnc === null) throw new Error(`Database::Credentials::Missing::${database.id}`);
        return JSON.parse(this.#cipher.decrypt(database.credentialsEnc)) as DatabaseCredentials;
    }

    async #provision(job: Job, database: Database): Promise<void>{
        const activity = this.#activity(job, database);
        const runtime = RUNTIMES[database.engine];
        const credentials = this.#credentials(database);
        const userId = database.userId ?? job.userId ?? 0;

        database.status = DatabaseStatus.Provisioning;
        await database.save();

        try{
            const network = await activity.step('Preparing the network', () => this.#network(database, userId));
            const image = await activity.step('Preparing the image', () => this.#image(database, runtime, userId));
            const container = await activity.step('Creating the database container',
                () => this.#container(database, runtime, credentials, userId, image.id, network.id));
            const binding = await activity.step('Publishing the port', () => this.#publish(container, credentials.port, userId));

            database.containerId = container.id;
            await database.save();

            await activity.step(`Starting ${runtime.image}:${image.tag}`, () => this.#start(container, runtime, credentials));
            await activity.step('Waiting for the database to accept connections',
                () => this.#awaitReady(container, runtime, credentials));

            const reachable = new DatabaseService().buildConnectionString(
                database.engine,
                { ...credentials, port: binding.externalPort },
                publicHost()
            );
            database.connectionStringEnc = this.#cipher.encrypt(reachable);
            database.status = DatabaseStatus.Running;
            await database.save();

            await activity.success(`Database ready on port ${binding.externalPort}`);
            logger.info(`database ${database.id} running on host port ${binding.externalPort}`, { scope: 'orchestrator.handler.database' });
        }catch(error){
            database.status = DatabaseStatus.Error;
            await database.save();
            await activity.fail('Provisioning failed', failureMessage(error));
            throw error;
        }
    }

    async #network(database: Database, userId: number): Promise<DockerNetwork>{
        if(database.containerId !== null){
            const container = await DockerContainer.findOneBy({ id: database.containerId });
            if(container){
                const existing = await DockerNetwork.findOneBy({ id: container.networkId });
                if(existing) return existing;
            }
        }

        const network = await DockerNetwork.create({
            name: `database-${database.id}`,
            dockerNetworkName: '',
            driver: NetworkDriver.Bridge,
            userId,
            organizationId: database.organizationId
        }).save();

        network.dockerNetworkName = `quantum-network-${network.id}`;
        await network.save();
        await materializeNetwork(network);
        return network;
    }

    async #image(database: Database, runtime: EngineRuntime, userId: number): Promise<DockerImage>{
        const tag = database.version ?? 'latest';
        const existing = await DockerImage.findOneBy({
            name: runtime.image,
            tag,
            organizationId: database.organizationId,
            userId
        });
        if(existing) return existing;

        return DockerImage.create({ name: runtime.image, tag, userId, organizationId: database.organizationId }).save();
    }

    async #container(
        database: Database,
        runtime: EngineRuntime,
        credentials: DatabaseCredentials,
        userId: number,
        imageId: number,
        networkId: number
    ): Promise<DockerContainer>{
        const existing = database.containerId === null
            ? null
            : await DockerContainer.findOneBy({ id: database.containerId });
        if(existing) return existing;

        const container = await DockerContainer.create({
            name: `database-${database.id}`,
            dockerContainerName: '',
            command: runtime.cmd?.(credentials).join(' ') ?? null,
            userId,
            organizationId: database.organizationId,
            networkId,
            imageId,
            isRepositoryContainer: false,
            environmentVariables: runtime.env(credentials),
            volumes: [
                { containerPath: runtime.dataDir, mode: 'rw' },
                { containerPath: BACKUP_DIR, mode: 'rw' }
            ]
        }).save();

        container.dockerContainerName = getSystemDockerName(container.id);
        container.storagePath = getContainerStoragePath(userId, container.id, database.name).containerStoragePath;
        await container.save();
        return container;
    }

    async #publish(container: DockerContainer, internalPort: number, userId: number): Promise<PortBinding>{
        const existing = await PortBinding.findOneBy({ containerId: container.id, internalPort });
        if(existing) return existing;

        return PortBinding.create({
            containerId: container.id,
            userId,
            organizationId: container.organizationId,
            internalPort,
            externalPort: await allocateHostPort(),
            protocol: PortBindingProtocol.Tcp
        }).save();
    }

    async #start(container: DockerContainer, runtime: EngineRuntime, credentials: DatabaseCredentials): Promise<void>{
        const ops = new ContainerOps(container);
        await ops.destroyContainer();
        await ops.createAndStartContainer({ cmd: runtime.cmd?.(credentials) });
    }

    async #awaitReady(container: DockerContainer, runtime: EngineRuntime, credentials: DatabaseCredentials): Promise<void>{
        const ops = new ContainerOps(container);
        const probe = runtime.ready(credentials);

        for(let attempt = 0; attempt < READY_ATTEMPTS; attempt++){
            const result = await ops.executeCommand(probe).catch(() => null);
            if(result !== null && result.exitCode === 0) return;
            await sleep(READY_INTERVAL_MS);
        }

        throw new Error(`Database::Ready::Timeout::${READY_ATTEMPTS * READY_INTERVAL_MS}ms`);
    }

    async #requireContainer(database: Database): Promise<DockerContainer>{
        if(database.containerId === null) throw new Error(`Database::Container::NotProvisioned::${database.id}`);
        const container = await DockerContainer.findOneBy({ id: database.containerId });
        if(!container) throw new Error(`Database::Container::NotFound::${database.containerId}`);
        return container;
    }

    async #exec(ops: ContainerOps, command: string, what: string): Promise<string>{
        const result = await ops.executeCommand(command);
        if(result.exitCode !== 0) throw new Error(`Database::${what}::Failed::${result.error || result.output || `exit ${result.exitCode}`}`);
        return result.output;
    }

    async #backup(job: Job, database: Database): Promise<void>{
        const activity = this.#activity(job, database);
        const runtime = RUNTIMES[database.engine];
        const credentials = this.#credentials(database);
        const container = await this.#requireContainer(database);
        const ops = new ContainerOps(container);

        database.status = DatabaseStatus.BackingUp;
        await database.save();

        try{
            const id = randomBytes(6).toString('hex');
            const file = `${BACKUP_DIR}/${id}.${runtime.backupExtension}`;

            await activity.step('Writing the dump', async () => {
                await this.#exec(ops, `mkdir -p '${BACKUP_DIR}'`, 'Backup');
                await this.#exec(ops, runtime.dump(credentials, file), 'Backup');
            });

            const size = await this.#exec(ops, `stat -c %s '${file}'`, 'Backup');
            const backup: DatabaseBackup = { id, path: file, sizeBytes: Number(size) || 0, createdAt: new Date().toISOString() };

            database.backups = [...database.backups, backup];
            database.status = DatabaseStatus.Running;
            await database.save();

            await activity.success(`Backup ${id} written (${backup.sizeBytes} bytes)`);
        }catch(error){
            database.status = DatabaseStatus.Running;
            await database.save();
            await activity.fail('Backup failed', failureMessage(error));
            throw error;
        }
    }

    async #restore(job: Job, database: Database, backupId: string): Promise<void>{
        const activity = this.#activity(job, database);
        const runtime = RUNTIMES[database.engine];
        const credentials = this.#credentials(database);
        const container = await this.#requireContainer(database);
        const ops = new ContainerOps(container);

        const backup = database.backups.find((entry) => entry.id === backupId);
        if(!backup) throw new Error(`Database::Backup::NotFound::${backupId}`);

        database.status = DatabaseStatus.Provisioning;
        await database.save();

        try{
            await activity.step(`Restoring backup ${backupId}`, () => this.#exec(ops, runtime.restore(credentials, backup.path), 'Restore'));
            if(runtime.restartsOnRestore){
                await activity.step('Waiting for the database to come back', () => this.#awaitReady(container, runtime, credentials));
            }

            database.status = DatabaseStatus.Running;
            await database.save();
            await activity.success(`Backup ${backupId} restored`);
        }catch(error){
            database.status = DatabaseStatus.Error;
            await database.save();
            await activity.fail('Restore failed', failureMessage(error));
            throw error;
        }
    }

    async #delete(job: Job): Promise<void>{
        const containerId = job.payload.containerId as number | null | undefined;
        if(containerId === undefined || containerId === null) return;

        const container = await DockerContainer.findOneBy({ id: containerId });
        if(!container) return;

        await new ContainerOps(container).removeContainer().catch((error) =>
            logger.warn(`could not remove database container ${container.dockerContainerName} — ${failureMessage(error)}`,
                { scope: 'orchestrator.handler.database' }));

        await PortBinding.delete({ containerId: container.id });
        const network = await DockerNetwork.findOneBy({ id: container.networkId });
        await container.remove();

        if(network){
            await teardownNetwork(network).catch(() => undefined);
            await network.remove();
        }

        logger.info(`database container ${containerId} removed`, { scope: 'orchestrator.handler.database' });
    }
}
