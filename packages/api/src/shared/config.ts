import { ConfigError } from '@/shared/errors/ConfigError';

const required = (key: string): string => {
    const value = process.env[key];
    if(value === undefined || value === '') throw ConfigError.MissingEnv(key);
    return value;
};

const optional = (key: string): string | undefined => {
    const value = process.env[key];
    return value === undefined || value === '' ? undefined : value;
};

const corsOrigins = (optional('CORS_ORIGIN') ?? 'http://localhost:5050')
    .split(',')
    .map((origin) => origin.trim())
    .filter((origin) => origin !== '');
const port = Number(optional('SERVER_PORT') ?? 7080);
const smtpPort = Number(optional('SMTP_PORT') ?? 587);

export const config = {
    nodeEnv: optional('NODE_ENV') ?? 'development',
    port,
    domain: required('DOMAIN'),
    clientHost: required('CLIENT_HOST'),
    corsOrigins,

    jwtSecret: required('SECRET_KEY'),
    jwtExpirationDays: Number(optional('JWT_EXPIRATION_DAYS') ?? 7),
    encryptionKey: required('ENCRYPTION_KEY'),
    registrationDisabled: optional('REGISTRATION_DISABLED') === 'true',

    databaseUrl: required('DATABASE_URL'),
    databaseSchema: optional('DATABASE_SCHEMA'),

    maxUploadBytes: Number(optional('MAX_UPLOAD_BYTES') ?? 10_485_760),

    log: {
        level: optional('LOG_LEVEL') ?? 'info',
        pretty: optional('LOG_PRETTY') === 'true'
    },

    github: {
        clientId: optional('GITHUB_CLIENT_ID'),
        clientSecret: optional('GITHUB_CLIENT_SECRET')
    },

    smtp: {
        host: optional('SMTP_HOST'),
        port: smtpPort,
        secure: optional('SMTP_SECURE') === 'true' || smtpPort === 465,
        user: optional('SMTP_AUTH_USER'),
        password: optional('SMTP_AUTH_PASSWORD'),
        from: optional('WEBMASTER_MAIL')
    },

    oauth: {
        callbackBaseUrl: optional('OAUTH_CALLBACK_BASE_URL') ?? `http://localhost:${port}`
    },

    docker: {
        apkStarterPackages: optional('DOCKER_APK_STARTER_PACKAGES') ?? 'git nodejs npm python3 py3-pip'
    },

    ingress: {
        enabled: optional('INGRESS_ENABLED') !== 'false',
        baseDomain: optional('BASE_DOMAIN'),
        acmeEmail: optional('ACME_EMAIL'),
        acmeCaServer: optional('ACME_CA_SERVER') ?? 'https://acme-staging-v02.api.letsencrypt.org/directory',
        /** Where the generated router configuration is written for the proxy to watch. */
        dynamicDir: optional('INGRESS_DYNAMIC_DIR') ?? '/var/lib/quantum/ingress'
    }
} as const;
