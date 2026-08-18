import { describe, it, expect } from 'vitest';
import { ENGINE_REGISTRY, getEngineSpec, SUPPORTED_ENGINES } from '@services/database/registry';
import { IDatabaseCredentials } from '@typings/models/database';

const creds: IDatabaseCredentials = {
    username: 'quantum_user',
    password: 's3cr3t-pass',
    database: 'appdb',
    port: 5432
};

describe('ENGINE_REGISTRY coverage', () => {
    it('supports exactly the five first-class engines', () => {
        expect(SUPPORTED_ENGINES.sort()).toEqual(
            ['mariadb', 'mongodb', 'mysql', 'postgres', 'redis'].sort()
        );
    });

    it('every engine declares an image, default version and default port', () => {
        for(const engine of SUPPORTED_ENGINES){
            const spec = ENGINE_REGISTRY[engine];
            expect(spec.image).toBeTruthy();
            expect(spec.defaultVersion).toBeTruthy();
            expect(spec.defaultPort).toBeGreaterThan(0);
        }
    });

    it('getEngineSpec throws on an unknown engine', () => {
        expect(() => getEngineSpec('cassandra' as any)).toThrow(/UnknownEngine/);
    });
});

describe('postgres spec', () => {
    const spec = ENGINE_REGISTRY.postgres;

    it('uses the alpine image and standard port', () => {
        expect(spec.image).toBe('postgres');
        expect(spec.defaultVersion).toBe('16-alpine');
        expect(spec.defaultPort).toBe(5432);
    });

    it('maps credentials to POSTGRES_* env keys', () => {
        const env = spec.envForCredentials(creds);
        expect(env).toEqual({
            POSTGRES_USER: 'quantum_user',
            POSTGRES_PASSWORD: 's3cr3t-pass',
            POSTGRES_DB: 'appdb'
        });
    });

    it('builds a postgresql:// connection string', () => {
        expect(spec.connectionString(creds, 'db-host')).toBe(
            'postgresql://quantum_user:s3cr3t-pass@db-host:5432/appdb'
        );
    });

    it('builds a pg_dump argv targeting the database and output file', () => {
        const cmd = spec.dumpCommand(creds, '/backups/dump.sql');
        expect(cmd[0]).toBe('sh');
        expect(cmd[1]).toBe('-c');
        expect(cmd[2]).toContain('pg_dump');
        expect(cmd[2]).toContain('appdb');
        expect(cmd[2]).toContain('/backups/dump.sql');

        expect(cmd[2]).not.toContain('s3cr3t-pass');
    });

    it('readiness probe uses pg_isready with the credentialed user/db', () => {
        expect(spec.readinessProbe(creds)).toEqual(['pg_isready', '-U', 'quantum_user', '-d', 'appdb']);
    });
});

describe('mysql spec', () => {
    const spec = ENGINE_REGISTRY.mysql;

    it('maps credentials to MYSQL_* env keys including a root password', () => {
        const env = spec.envForCredentials(creds);
        expect(env.MYSQL_USER).toBe('quantum_user');
        expect(env.MYSQL_PASSWORD).toBe('s3cr3t-pass');
        expect(env.MYSQL_DATABASE).toBe('appdb');
        expect(env.MYSQL_ROOT_PASSWORD).toBeTruthy();
    });

    it('builds a mysql:// connection string', () => {
        expect(spec.connectionString(creds, 'db-host')).toBe(
            'mysql://quantum_user:s3cr3t-pass@db-host:5432/appdb'
        );
    });

    it('dump command invokes mysqldump for the database', () => {
        const cmd = spec.dumpCommand(creds, '/backups/dump.sql');
        expect(cmd[2]).toContain('mysqldump');
        expect(cmd[2]).toContain('appdb');
    });
});

describe('mariadb spec', () => {
    const spec = ENGINE_REGISTRY.mariadb;

    it('uses mariadb image v11 on port 3306', () => {
        expect(spec.image).toBe('mariadb');
        expect(spec.defaultVersion).toBe('11');
        expect(spec.defaultPort).toBe(3306);
    });

    it('maps credentials to MARIADB_* env keys', () => {
        const env = spec.envForCredentials(creds);
        expect(env.MARIADB_USER).toBe('quantum_user');
        expect(env.MARIADB_DATABASE).toBe('appdb');
    });
});

describe('mongodb spec', () => {
    const spec = ENGINE_REGISTRY.mongodb;

    it('uses mongo:7 on port 27017', () => {
        expect(spec.image).toBe('mongo');
        expect(spec.defaultVersion).toBe('7');
        expect(spec.defaultPort).toBe(27017);
    });

    it('maps credentials to MONGO_INITDB_* env keys', () => {
        const env = spec.envForCredentials(creds);
        expect(env.MONGO_INITDB_ROOT_USERNAME).toBe('quantum_user');
        expect(env.MONGO_INITDB_ROOT_PASSWORD).toBe('s3cr3t-pass');
    });

    it('builds a mongodb:// connection string with authSource', () => {
        expect(spec.connectionString(creds, 'db-host')).toBe(
            'mongodb://quantum_user:s3cr3t-pass@db-host:5432/appdb?authSource=admin'
        );
    });

    it('dump command invokes mongodump with an archive', () => {
        const cmd = spec.dumpCommand(creds, '/backups/dump.archive');
        expect(cmd[2]).toContain('mongodump');
        expect(cmd[2]).toContain('--archive="/backups/dump.archive"');
    });
});

describe('redis spec', () => {
    const spec = ENGINE_REGISTRY.redis;

    it('uses redis:7-alpine on port 6379', () => {
        expect(spec.image).toBe('redis');
        expect(spec.defaultVersion).toBe('7-alpine');
        expect(spec.defaultPort).toBe(6379);
    });

    it('builds a redis:// connection string with the password', () => {
        expect(spec.connectionString(creds, 'db-host')).toBe(
            'redis://:s3cr3t-pass@db-host:5432'
        );
    });

    it('readiness probe reads the password from env (not argv) so it does not leak into ps/docker top', () => {

        expect(spec.readinessProbe(creds)).toEqual([
            'sh', '-c', 'REDISCLI_AUTH="$REDIS_PASSWORD" redis-cli PING'
        ]);
    });
});
