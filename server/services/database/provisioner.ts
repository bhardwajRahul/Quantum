import crypto from 'crypto';
import { v4 } from 'uuid';
import Database from '@models/database';
import DockerContainer from '@models/docker/container';
import DockerImage from '@models/docker/image';
import DockerNetwork from '@models/docker/network';
import DockerContainerService, { materializeContainer } from '@services/docker/container';
import { pullImage, createAndMaterializeImage } from '@services/docker/image';
import { createAndMaterializeNetwork } from '@services/docker/network';
import { connectContainerToEdge } from '@services/ingress';
import { getEngineSpec } from '@services/database/registry';
import { encrypt } from '@utilities/encryption';
import logger from '@utilities/logger';
import { IDatabase, IDatabaseCredentials, IDatabaseBackup } from '@typings/models/database';
import { IDockerContainer } from '@typings/models/docker/container';
import { ActivityReporter } from '@typings/services/activity';

const BACKUP_DIR = '/var/lib/quantum-backups';

const generateCredentials = (engine: string, port: number): IDatabaseCredentials => {
    const username = `qdb_${crypto.randomBytes(4).toString('hex')}`;
    const password = crypto.randomBytes(24).toString('base64url');
    const database = `${engine}_${crypto.randomBytes(4).toString('hex')}`;
    return { username, password, database, port };
};

const loadWithSecrets = (databaseId: string) =>
    Database.findById(databaseId).select('+credentialsEnc +connectionStringEnc');

const waitForReadiness = async (
    service: DockerContainerService,
    engine: IDatabase['engine'],
    creds: IDatabaseCredentials,
    env: string[]
): Promise<void> => {
    const spec = getEngineSpec(engine);
    const probe = spec.readinessProbe(creds);
    const attempts = Number(process.env.DB_READINESS_ATTEMPTS) || 30;
    const delayMs = Number(process.env.DB_READINESS_DELAY_MS) || 2000;
    for(let attempt = 1; attempt <= attempts; attempt++){
        try{
            const result = await service.executeCommand(probe, { Env: env });
            if(result.exitCode === 0) return;
        }catch(error){

        }
        await new Promise((resolve) => setTimeout(resolve, delayMs));
    }
    throw new Error(`Database::Provision::ReadinessTimeout::${engine}`);
};

export const provisionDatabase = async (database: IDatabase, act: ActivityReporter): Promise<IDatabase> => {

    if(database.container){
        act.progress('Already provisioned');
        const existing = await loadWithSecrets(database._id.toString());
        if(existing && existing.status !== 'running'){
            existing.status = 'running';
            await existing.save();
        }
        return existing || database;
    }

    const doc = (await loadWithSecrets(database._id.toString())) as IDatabase;
    if(!doc) throw new Error('Database::Provision::NotFound');

    const spec = getEngineSpec(doc.engine);
    const version = doc.version || spec.defaultVersion;
    if(!doc.version) doc.version = version;

    doc.status = 'provisioning';
    await doc.save();

    try{
        const creds = generateCredentials(doc.engine, spec.defaultPort);
        const envMap = spec.envForCredentials(creds);
        const envEntries = Object.entries(envMap);

        await act.step(`Pulling ${doc.engine} image`, () => pullImage(spec.image, version));
        const ownerId = doc.user?.toString();
        const organizationId = (doc as any).organization;
        let image = await DockerImage.findOne({ user: ownerId, name: spec.image, tag: version });
        if(!image){
            image = await createAndMaterializeImage({ user: ownerId, organization: organizationId, name: spec.image, tag: version });
        }

        const network = await act.step('Creating network', () => createAndMaterializeNetwork({
            name: `db-${doc.engine}-${v4().slice(0, 8)}`,
            user: ownerId,
            organization: organizationId
        }));

        const containerName = `${doc.engine}-${doc.name}-${v4().slice(0, 4)}`
            .toLowerCase()
            .replace(/[^a-z0-9_.-]/g, '-');
        const envVariables = new Map<string, string>(envEntries);

        const command = doc.engine === 'redis'
            ? `redis-server --requirepass ${creds.password}`
            : undefined;

        const container = await act.step(`Starting ${doc.engine} container`, async () => {
            const created = await DockerContainer.create({
                user: ownerId,
                organization: organizationId,
                image: image._id,
                network: network._id,
                name: containerName,
                command,
                environment: { variables: envVariables }
            });
            await materializeContainer(created as unknown as IDockerContainer);
            return created;
        });

        await act.step('Connecting to edge network', () => connectContainerToEdge(doc.nodeId, container.dockerContainerName));

        const service = new DockerContainerService(container);
        const envArray = envEntries.map(([k, v]) => `${k}=${v}`);

        const probeEnv = [
            ...envArray,
            `PGUSER=${creds.username}`,
            `PGPASSWORD=${creds.password}`,
            `MYSQL_PWD=${creds.password}`,
            `MONGO_PWD=${creds.password}`,
            `MONGODB_USER=${creds.username}`,
            `MONGODB_PASSWORD=${creds.password}`,
            `REDIS_PASSWORD=${creds.password}`
        ];
        await act.step('Waiting for readiness', () => waitForReadiness(service, doc.engine, creds, probeEnv));

        await act.step('Storing credentials', async () => {
            const connectionString = spec.connectionString(creds, container.dockerContainerName);
            doc.container = container._id as any;
            doc.credentialsEnc = encrypt(JSON.stringify(creds));
            doc.connectionStringEnc = encrypt(connectionString);
            doc.status = 'running';
            await doc.save();
        });

        logger.info(`@services/database/provisioner.ts (provisionDatabase): provisioned ${doc.engine} database ${doc._id}`);
        return doc;
    }catch(error){
        doc.status = 'error';
        await doc.save().catch(() => undefined);
        logger.error('@services/database/provisioner.ts (provisionDatabase): ' + error);
        throw error;
    }
};

const resolveRuntime = async (databaseId: string) => {
    const doc = await loadWithSecrets(databaseId);
    if(!doc) throw new Error('Database::Runtime::NotFound');
    if(!doc.container) throw new Error('Database::Runtime::NotProvisioned');
    const creds = doc.getDecryptedCredentials();
    if(!creds) throw new Error('Database::Runtime::CredentialsUnavailable');
    const container = await DockerContainer.findById(doc.container);
    if(!container) throw new Error('Database::Runtime::ContainerMissing');
    const service = new DockerContainerService(container as IDockerContainer);
    const env = [
        `PGUSER=${creds.username}`,
        `PGPASSWORD=${creds.password}`,
        `MYSQL_PWD=${creds.password}`,
        `MONGO_PWD=${creds.password}`,
        `MONGODB_USER=${creds.username}`,
        `MONGODB_PASSWORD=${creds.password}`,
        `REDIS_PASSWORD=${creds.password}`
    ];
    return { doc, creds, service, env };
};

export const backupDatabase = async (database: IDatabase, act: ActivityReporter): Promise<IDatabaseBackup> => {
    const { doc, creds, service, env } = await resolveRuntime(database._id.toString());
    const spec = getEngineSpec(doc.engine);

    doc.status = 'backing-up';
    await doc.save();

    try{
        const backupId = v4();
        const outputPath = `${BACKUP_DIR}/${backupId}.dump`;
        const backup = await act.step('Dumping database', async (): Promise<IDatabaseBackup> => {
            await service.executeCommand(['sh', '-c', `mkdir -p "${BACKUP_DIR}"`]);
            const dump = await service.executeCommand(spec.dumpCommand(creds, outputPath), { Env: env });
            if(dump.exitCode !== 0){
                throw new Error(`Database::Backup::DumpFailed::${dump.error || dump.exitCode}`);
            }

            let sizeBytes = 0;
            try{
                const stat = await service.executeCommand(['sh', '-c', `wc -c < "${outputPath}"`]);
                sizeBytes = parseInt(stat.output.trim(), 10) || 0;
            }catch(error){

            }

            return { id: backupId, path: outputPath, sizeBytes, createdAt: new Date() };
        });

        await act.step('Recording backup', async () => {
            doc.backups.push(backup);
            doc.status = 'running';
            await doc.save();
        });
        logger.info(`@services/database/provisioner.ts (backupDatabase): backed up ${doc._id} -> ${backupId}`);
        return backup;
    }catch(error){
        doc.status = 'running';
        await doc.save().catch(() => undefined);
        logger.error('@services/database/provisioner.ts (backupDatabase): ' + error);
        throw error;
    }
};

export const restoreDatabase = async (database: IDatabase, backupId: string, act: ActivityReporter): Promise<void> => {
    const { doc, creds, service, env } = await resolveRuntime(database._id.toString());
    const spec = getEngineSpec(doc.engine);
    const backup = doc.backups.find((entry) => entry.id === backupId);
    if(!backup){
        throw new Error(`Database::Restore::BackupNotFound::${backupId}`);
    }
    await act.step('Restoring from backup', async () => {
        const result = await service.executeCommand(spec.restoreCommand(creds, backup.path), { Env: env });
        if(result.exitCode !== 0){
            throw new Error(`Database::Restore::Failed::${result.error || result.exitCode}`);
        }
    });
    logger.info(`@services/database/provisioner.ts (restoreDatabase): restored ${doc._id} from ${backupId}`);
};

export default { provisionDatabase, backupDatabase, restoreDatabase };
