export {};

const databaseUrl = process.env.DATABASE_URL ?? 'postgres://quantum:quantum@localhost:5434/quantum';
const schema = `test_${(process.env.VITEST_POOL_ID ?? '1').replace(/\W/g, '')}`;

Object.assign(process.env, {
    NODE_ENV: 'test',
    DOMAIN: 'http://localhost:3000',
    CLIENT_HOST: 'http://localhost:5050',
    CORS_ORIGIN: 'http://localhost:5050',
    SECRET_KEY: 'test-secret-key',
    ENCRYPTION_KEY: '0'.repeat(64),
    SERVER_PORT: '3000',
    DATABASE_URL: databaseUrl,
    DATABASE_SCHEMA: schema,
    LOG_LEVEL: 'silent',
    LOG_PRETTY: 'false'
});

const { Client } = await import('pg');
const client = new Client({ connectionString: databaseUrl });
await client.connect();
await client.query(`CREATE SCHEMA IF NOT EXISTS "${schema}"`);
await client.end();
