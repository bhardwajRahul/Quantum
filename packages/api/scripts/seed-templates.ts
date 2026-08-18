import slugify from 'slugify';
import { createDataSource } from '@/core/models/data-source';
import ModuleDiscovery from '@/core/modules/discovery';
import Template from '@/modules/template/models/Template';
import { TemplateSource } from '@quantum/contracts/modules/template/domain';
import { logger } from '@/shared/utils/Logger';
import type { TemplateServiceSpec, TemplateSpec } from '@quantum/contracts/modules/template/domain';

interface LegacyImage{
    name: string;
    tag: string | number;
}

interface LegacyPort{
    protocol: string;
    internalPort: string | number;
}

interface LegacyVolume{
    containerPath: string;
    mode?: string;
}

interface LegacyDependency{
    name: string;
    image: LegacyImage;
    ports?: LegacyPort[];
    volumes?: LegacyVolume[];
    environment?: Record<string, string>;
}

interface LegacyTemplate{
    name: string;
    category: string;
    website?: string;
    description: string;
    image: LegacyImage;
    ports?: LegacyPort[];
    volumes?: LegacyVolume[];
    environment?: Record<string, string>;
    dependencies?: Record<string, LegacyDependency>;
}

// Straight port of the legacy catalog (server/… template fixtures). `command: "/bin/sh"` and
// per-service `notification` blocks were boilerplate/unused in the legacy data and have no
// equivalent in TemplateSpec, so they're intentionally dropped rather than carried over.
// `{server_ip}` / `${Service.externalPort}` interpolation is resolved below to the dependency's
// service key and container-internal port, since services in the new model reach each other by
// service name on the deployment's private network (there is no "external port" concept here).
const LEGACY_TEMPLATES: LegacyTemplate[] = [
    {
        name: 'Directus',
        category: 'cms',
        website: 'https://directus.io/',
        description: 'Turn your data into a headless CMS, admin panels, or apps. Built for devs, used by everyone.',
        image: { name: 'directus/directus', tag: '11.3.2' },
        volumes: [{ containerPath: '/directus/uploads' }, { containerPath: '/directus/extensions' }],
        ports: [{ protocol: 'tcp', internalPort: 8055 }],
        environment: {
            SECRET: 'replace-with-secure-random-value',
            DB_CLIENT: 'pg',
            DB_HOST: '{server_ip:postgres}',
            DB_PORT: '${postgres.port}',
            DB_DATABASE: 'directus',
            DB_USER: 'directus',
            DB_PASSWORD: 'directus',
            CACHE_ENABLED: 'true',
            CACHE_AUTO_PURGE: 'true',
            CACHE_STORE: 'redis',
            REDIS: 'redis://{server_ip:redis}:${redis.port}',
            ADMIN_EMAIL: 'admin@example.com',
            ADMIN_PASSWORD: 'toortoor'
        },
        dependencies: {
            redis: { name: 'Directus-Redis-DB', image: { name: 'redis', tag: 'latest' }, ports: [{ protocol: 'tcp', internalPort: 6379 }] },
            postgres: {
                name: 'Directus-Postgres-DB',
                image: { name: 'postgis/postgis', tag: '13-master' },
                volumes: [{ containerPath: '/var/lib/postgresql/data' }],
                ports: [{ protocol: 'tcp', internalPort: 5432 }],
                environment: { POSTGRES_USER: 'directus', POSTGRES_PASSWORD: 'directus', POSTGRES_DB: 'directus' }
            }
        }
    },
    {
        name: 'Uptime Kuma',
        category: 'monitoring',
        description: 'Self-hosted, open-source, fancy uptime monitoring and alerting system.',
        image: { name: 'louislam/uptime-kuma', tag: 1 },
        ports: [{ protocol: 'tcp', internalPort: 3001 }],
        volumes: [{ containerPath: '/app/data' }]
    },
    {
        name: 'Appsmith',
        category: 'low-code',
        description: 'Build better apps, faster, with fewer resources. Leading companies are innovating with Appsmith.',
        image: { name: 'index.docker.io/appsmith/appsmith-ee', tag: 'latest' },
        ports: [{ protocol: 'tcp', internalPort: 80 }],
        volumes: [{ containerPath: '/appsmith-stacks' }]
    },
    {
        name: 'ownCloud',
        category: 'storage',
        website: 'https://owncloud.com/',
        description: 'An open-source file sync, share and content collaboration software.',
        image: { name: 'owncloud/server', tag: 'latest' },
        ports: [{ protocol: 'tcp', internalPort: 8080 }],
        environment: { OWNCLOUD_ADMIN_USERNAME: 'admin', OWNCLOUD_ADMIN_PASSWORD: 'toortoor' },
        volumes: [{ containerPath: '/mnt/data' }]
    },
    {
        name: 'ActivePieces',
        category: 'automation',
        website: 'https://www.activepieces.com/',
        description: "Automation software that's AI-first, no-code & open-source.",
        image: { name: 'activepieces/activepieces', tag: 'latest' },
        ports: [{ protocol: 'tcp', internalPort: 80 }],
        volumes: [{ containerPath: '/root/.activepieces' }],
        environment: { AP_QUEUE_MODE: 'MEMORY', AP_DB_TYPE: 'SQLITE3' }
    },
    {
        name: 'n8n',
        category: 'automation',
        website: 'https://n8n.io/',
        description: 'Secure and AI-native workflow automation tool for technical people. Insert code when you need it.',
        image: { name: 'docker.n8n.io/n8nio/n8n', tag: 'latest' },
        ports: [{ protocol: 'tcp', internalPort: 5678 }],
        volumes: [{ containerPath: '/home/node/.n8n' }],
        environment: {
            DB_TYPE: 'postgresdb',
            DB_POSTGRESDB_DATABASE: 'n8n',
            DB_POSTGRESDB_HOST: '{server_ip:postgres}',
            DB_POSTGRESDB_PORT: '${postgres.port}',
            DB_POSTGRESDB_USER: 'root',
            DB_POSTGRESDB_PASSWORD: 'changeme',
            N8N_ENFORCE_SETTINGS_FILE_PERMISSIONS: 'true',
            N8N_SECURE_COOKIE: 'false'
        },
        dependencies: {
            postgres: {
                name: 'n8n-DB',
                image: { name: 'postgres', tag: 'latest' },
                volumes: [{ containerPath: '/var/lib/postgresql/data', mode: 'rw' }],
                ports: [{ protocol: 'tcp', internalPort: 5432 }],
                environment: { POSTGRES_USER: 'root', POSTGRES_PASSWORD: 'changeme', POSTGRES_DB: 'n8n' }
            }
        }
    },
    {
        name: 'Tooljet',
        category: 'low-code',
        website: 'https://www.tooljet.com/',
        description: 'Open-source low-code framework to build and deploy internal tools with minimal engineering effort.',
        image: { name: 'tooljet/try', tag: 'ee-lts-latest' },
        ports: [{ protocol: 'tcp', internalPort: 80 }],
        volumes: [{ containerPath: '/var/lib/postgresql/13/main' }]
    },
    {
        name: 'Ollama',
        category: 'ai',
        website: 'https://ollama.com/',
        description: 'The easiest way to get up and running with large language models.',
        image: { name: 'ollama/ollama', tag: 'latest' },
        ports: [{ protocol: 'tcp', internalPort: 11434 }],
        volumes: [{ containerPath: '/root/.ollama' }]
    },
    {
        name: 'Homarr',
        category: 'dashboard',
        website: 'https://homarr.dev/',
        description: 'A simple, yet powerful dashboard for your server.',
        image: { name: 'ghcr.io/ajnart/homarr', tag: 'latest' },
        volumes: [
            { containerPath: '/app/data/configs' },
            { containerPath: '/app/public/icons' },
            { containerPath: '/data' }
        ],
        ports: [{ protocol: 'tcp', internalPort: 7575 }]
    },
    {
        name: 'Eclipse Mosquitto',
        category: 'messaging',
        website: 'https://mosquitto.org/',
        description: 'An open source message broker which implements MQTT version 5, 3.1.1 and 3.1.',
        image: { name: 'eclipse-mosquitto', tag: 'latest' },
        volumes: [{ containerPath: '/mosquitto/config' }],
        ports: [{ protocol: 'tcp', internalPort: 1883 }]
    },
    {
        name: 'phpMyAdmin',
        category: 'database',
        website: 'https://www.phpmyadmin.net/',
        description: 'A free software tool written in PHP, intended to handle the administration of MySQL over the Web.',
        image: { name: 'phpmyadmin', tag: 'latest' },
        ports: [{ protocol: 'tcp', internalPort: 80 }],
        volumes: [{ containerPath: '/etc/phpmyadmin' }],
        environment: {
            PMA_HOST: 'Address/hostname of your MySQL/MariaDB server',
            PMA_PORT: 'Port of the MySQL/MariaDB server',
            PMA_USER: 'MySQL/MariaDB user',
            PMA_PASSWORD: 'MySQL/MariaDB password'
        }
    },
    {
        name: 'Mongo',
        category: 'database',
        website: 'https://www.mongodb.com/',
        description: 'MongoDB document databases provide high availability and easy scalability.',
        image: { name: 'mongo', tag: 'latest' },
        ports: [{ protocol: 'tcp', internalPort: 27017 }],
        volumes: [{ containerPath: '/data/db', mode: 'rw' }],
        environment: { MONGO_INITDB_ROOT_USERNAME: 'root', MONGO_INITDB_ROOT_PASSWORD: 'example' }
    },
    {
        name: 'MariaDB',
        category: 'database',
        description: 'One of the most popular open source relational databases.',
        image: { name: 'mariadb', tag: 'latest' },
        volumes: [{ containerPath: '/var/lib/mysql', mode: 'rw' }],
        ports: [{ protocol: 'tcp', internalPort: 3306 }],
        environment: { MARIADB_DATABASE: 'default', MARIADB_USER: 'root', MARIADB_ROOT_PASSWORD: 'secret' }
    },
    {
        name: 'PostgreSQL',
        category: 'database',
        website: 'https://www.postgresql.org/',
        description: 'The PostgreSQL object-relational database system provides reliability and data integrity.',
        image: { name: 'postgres', tag: 'latest' },
        volumes: [{ containerPath: '/var/lib/postgresql/data', mode: 'rw' }],
        ports: [{ protocol: 'tcp', internalPort: 5432 }],
        environment: { POSTGRES_USER: 'root', POSTGRES_PASSWORD: 'changeme', POSTGRES_DB: 'default' }
    },
    {
        name: 'MySQL',
        category: 'database',
        website: 'https://mysql.com/',
        description: 'MySQL is a widely used, open-source relational database management system (RDBMS).',
        image: { name: 'mysql', tag: 'latest' },
        volumes: [{ containerPath: '/var/lib/mysql', mode: 'rw' }],
        ports: [{ protocol: 'tcp', internalPort: 3306 }],
        environment: { MYSQL_ROOT_PASSWORD: 'my-secret-pw' }
    },
    {
        name: 'Kali Linux',
        category: 'os',
        website: 'https://www.kali.org/',
        description: 'Penetration testing and ethical hacking Linux distribution.',
        image: { name: 'kalilinux/kali-rolling', tag: 'latest' }
    },
    {
        name: 'Alpine Linux',
        category: 'os',
        website: 'https://alpinelinux.org',
        description: 'A security-oriented, lightweight Linux distribution based on musl libc and busybox.',
        image: { name: 'alpine', tag: 'latest' }
    },
    {
        name: 'Ubuntu',
        category: 'os',
        website: 'https://ubuntu.com',
        description: 'A Debian-based Linux operating system based on free software.',
        image: { name: 'ubuntu', tag: 'latest' }
    },
    {
        name: 'Code Server',
        category: 'dev-tools',
        website: 'https://hub.docker.com/r/linuxserver/code-server',
        description: 'Code on any device with a consistent development environment.',
        image: { name: 'codercom/code-server', tag: 'latest' },
        ports: [{ protocol: 'tcp', internalPort: 8080 }],
        environment: { PASSWORD: 'toortoor' }
    },
    {
        name: 'Wordpress',
        category: 'cms',
        website: 'https://wordpress.com/',
        description: 'Everything you need to build and grow any website — all in one place.',
        image: { name: 'wordpress', tag: 'latest' },
        ports: [{ protocol: 'tcp', internalPort: 80 }],
        volumes: [{ containerPath: '/var/www/html', mode: 'rw' }],
        environment: {
            WORDPRESS_DB_NAME: 'wordpress',
            WORDPRESS_DB_HOST: '{server_ip:mariadb}:${mariadb.port}',
            WORDPRESS_DB_USER: 'manager',
            WORDPRESS_DB_PASSWORD: 'secret'
        },
        dependencies: {
            mariadb: {
                name: 'Wordpress-DB',
                image: { name: 'mariadb', tag: 'latest' },
                volumes: [{ containerPath: '/var/lib/mysql', mode: 'rw' }],
                ports: [{ protocol: 'tcp', internalPort: 3306 }],
                environment: { MARIADB_DATABASE: 'wordpress', MARIADB_USER: 'manager', MARIADB_ROOT_PASSWORD: 'secret' }
            }
        }
    },
    {
        name: 'NGINX',
        category: 'web-server',
        website: 'https://nginx.org/',
        description: 'An open source reverse proxy server for HTTP, HTTPS, SMTP, POP3, and IMAP protocols.',
        image: { name: 'nginx', tag: 'latest' },
        ports: [{ protocol: 'tcp', internalPort: 80 }]
    }
];

const ENGINE_BY_IMAGE: Record<string, string> = {
    postgres: 'postgres',
    'postgis/postgis': 'postgres',
    mysql: 'mysql',
    mariadb: 'mariadb',
    mongo: 'mongodb',
    redis: 'redis'
};

const toPort = (port: LegacyPort) => ({ target: Number(port.internalPort), protocol: port.protocol });

const toVolume = (volume: LegacyVolume) => ({ path: volume.containerPath, mode: volume.mode });

// `{server_ip:key}` -> the dependency's service key (services reach each other by name).
// `${key.port}` -> that dependency's own container-internal port, resolved below.
const resolvePlaceholders = (value: string, dependencies: Record<string, LegacyDependency>): string =>
    value
        .replace(/\{server_ip:(\w+)\}/g, (_, key: string) => key)
        .replace(/\$\{(\w+)\.port\}/g, (_, key: string) => {
            const port = dependencies[key]?.ports?.[0]?.internalPort;
            return port !== undefined ? String(port) : '';
        });

const resolveEnvironment = (
    environment: Record<string, string> | undefined,
    dependencies: Record<string, LegacyDependency>
): Record<string, string> | undefined => {
    if(!environment) return undefined;
    const resolved: Record<string, string> = {};
    for(const [key, value] of Object.entries(environment)) resolved[key] = resolvePlaceholders(value, dependencies);
    return resolved;
};

const toSpec = (legacy: LegacyTemplate): TemplateSpec => {
    const dependencies = legacy.dependencies ?? {};
    const services: Record<string, TemplateServiceSpec> = {};

    services.app = {
        image: `${legacy.image.name}:${legacy.image.tag}`,
        environment: resolveEnvironment(legacy.environment, dependencies),
        ports: legacy.ports?.map(toPort),
        volumes: legacy.volumes?.map(toVolume),
        depends_on: Object.keys(dependencies).length ? Object.keys(dependencies) : undefined,
        kind: 'app'
    };

    for(const [key, dependency] of Object.entries(dependencies)){
        services[key] = {
            image: `${dependency.image.name}:${dependency.image.tag}`,
            environment: dependency.environment,
            ports: dependency.ports?.map(toPort),
            volumes: dependency.volumes?.map(toVolume),
            kind: 'database',
            engine: ENGINE_BY_IMAGE[dependency.image.name]
        };
    }

    return { services };
};

const seed = async () => {
    const { entities } = await new ModuleDiscovery().discover();
    const dataSource = createDataSource(entities);
    await dataSource.initialize();

    let created = 0;
    let skipped = 0;

    for(const legacy of LEGACY_TEMPLATES){
        const slug = slugify(legacy.name, { lower: true, strict: true });
        const exists = await Template.findOneBy({ slug, version: '1.0.0' });
        if(exists){ skipped++; continue; }

        await Template.create({
            name: legacy.name,
            slug,
            version: '1.0.0',
            category: legacy.category,
            description: legacy.description,
            icon: null,
            website: legacy.website ?? null,
            source: TemplateSource.Builtin,
            organizationId: null,
            spec: toSpec(legacy),
            inputsSchema: []
        }).save();
        created++;
    }

    logger.info(`template catalog seeded: ${created} created, ${skipped} already present`, { scope: 'scripts.seed-templates' });
    await dataSource.destroy();
};

seed().catch((error) => {
    logger.error('template catalog seed failed', error, { scope: 'scripts.seed-templates' });
    process.exitCode = 1;
});
