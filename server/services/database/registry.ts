import { DatabaseEngine, IDatabaseCredentials } from '@typings/models/database';

export interface EngineSpec{

    image: string;

    defaultVersion: string;

    defaultPort: number;

    envForCredentials(creds: IDatabaseCredentials): Record<string, string>;

    connectionString(creds: IDatabaseCredentials, host: string): string;

    dumpCommand(creds: IDatabaseCredentials, outputPath: string): string[];

    restoreCommand(creds: IDatabaseCredentials, inputPath: string): string[];

    readinessProbe(creds: IDatabaseCredentials): string[];
}

const sh = (script: string): string[] => ['sh', '-c', script];

export const ENGINE_REGISTRY: Record<DatabaseEngine, EngineSpec> = {
    postgres: {
        image: 'postgres',
        defaultVersion: '16-alpine',
        defaultPort: 5432,
        envForCredentials: (c) => ({
            POSTGRES_USER: c.username,
            POSTGRES_PASSWORD: c.password,
            POSTGRES_DB: c.database
        }),
        connectionString: (c, host) =>
            `postgresql://${c.username}:${c.password}@${host}:${c.port}/${c.database}`,

        dumpCommand: (c, out) =>
            sh(`pg_dump -U "$PGUSER" -d "${c.database}" -f "${out}"`),
        restoreCommand: (c, input) =>
            sh(`psql -U "$PGUSER" -d "${c.database}" -f "${input}"`),
        readinessProbe: (c) => ['pg_isready', '-U', c.username, '-d', c.database]
    },
    mysql: {
        image: 'mysql',
        defaultVersion: '8',
        defaultPort: 3306,
        envForCredentials: (c) => ({
            MYSQL_USER: c.username,
            MYSQL_PASSWORD: c.password,
            MYSQL_DATABASE: c.database,

            MYSQL_ROOT_PASSWORD: c.password
        }),
        connectionString: (c, host) =>
            `mysql://${c.username}:${c.password}@${host}:${c.port}/${c.database}`,

        dumpCommand: (c, out) =>
            sh(`mysqldump -u "${c.username}" "${c.database}" > "${out}"`),
        restoreCommand: (c, input) =>
            sh(`mysql -u "${c.username}" "${c.database}" < "${input}"`),
        readinessProbe: (c) => ['mysqladmin', 'ping', '-u', c.username, '--silent']
    },
    mariadb: {
        image: 'mariadb',
        defaultVersion: '11',
        defaultPort: 3306,
        envForCredentials: (c) => ({
            MARIADB_USER: c.username,
            MARIADB_PASSWORD: c.password,
            MARIADB_DATABASE: c.database,
            MARIADB_ROOT_PASSWORD: c.password
        }),
        connectionString: (c, host) =>
            `mysql://${c.username}:${c.password}@${host}:${c.port}/${c.database}`,
        dumpCommand: (c, out) =>
            sh(`mariadb-dump -u "${c.username}" "${c.database}" > "${out}"`),
        restoreCommand: (c, input) =>
            sh(`mariadb -u "${c.username}" "${c.database}" < "${input}"`),
        readinessProbe: (c) => ['mariadb-admin', 'ping', '-u', c.username, '--silent']
    },
    mongodb: {
        image: 'mongo',
        defaultVersion: '7',
        defaultPort: 27017,
        envForCredentials: (c) => ({
            MONGO_INITDB_ROOT_USERNAME: c.username,
            MONGO_INITDB_ROOT_PASSWORD: c.password,
            MONGO_INITDB_DATABASE: c.database
        }),
        connectionString: (c, host) =>
            `mongodb://${c.username}:${c.password}@${host}:${c.port}/${c.database}?authSource=admin`,
        dumpCommand: (c, out) =>
            sh(`mongodump --username "${c.username}" --password "$MONGO_PWD" --authenticationDatabase admin --db "${c.database}" --archive="${out}"`),
        restoreCommand: (c, input) =>
            sh(`mongorestore --username "${c.username}" --password "$MONGO_PWD" --authenticationDatabase admin --archive="${input}"`),

        readinessProbe: (_c) => [
            'sh', '-c',
            'mongosh --quiet --username "$MONGODB_USER" --password "$MONGODB_PASSWORD" --authenticationDatabase admin --eval "db.adminCommand(\\"ping\\")"'
        ]
    },
    redis: {
        image: 'redis',
        defaultVersion: '7-alpine',
        defaultPort: 6379,

        envForCredentials: (c) => ({
            REDIS_PASSWORD: c.password
        }),
        connectionString: (c, host) =>
            `redis://:${c.password}@${host}:${c.port}`,

        dumpCommand: (c, out) =>
            sh(`REDISCLI_AUTH="$REDIS_PASSWORD" redis-cli SAVE && cp /data/dump.rdb "${out}"`),
        restoreCommand: (c, input) =>
            sh(`cp "${input}" /data/dump.rdb && REDISCLI_AUTH="$REDIS_PASSWORD" redis-cli DEBUG RELOAD`),

        readinessProbe: (_c) => ['sh', '-c', 'REDISCLI_AUTH="$REDIS_PASSWORD" redis-cli PING']
    }
};

export const getEngineSpec = (engine: DatabaseEngine): EngineSpec => {
    const spec = ENGINE_REGISTRY[engine];
    if(!spec){
        throw new Error(`Database::Registry::UnknownEngine::${engine}`);
    }
    return spec;
};

export const SUPPORTED_ENGINES = Object.keys(ENGINE_REGISTRY) as DatabaseEngine[];

export default ENGINE_REGISTRY;
