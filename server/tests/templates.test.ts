import { describe, it, expect } from 'vitest';
import { parseCompose, splitImageRef, topologicalOrder } from '@services/templates/compose';
import { resolveEnv } from '@services/templates/interpolate';

describe('compose.splitImageRef', () => {
    it('defaults the tag to latest', () => {
        expect(splitImageRef('nginx')).toEqual({ name: 'nginx', tag: 'latest' });
    });
    it('splits name:tag', () => {
        expect(splitImageRef('postgres:16-alpine')).toEqual({ name: 'postgres', tag: '16-alpine' });
    });
    it('keeps a registry host:port in the name (only the last segment carries a tag)', () => {
        expect(splitImageRef('localhost:5000/app')).toEqual({ name: 'localhost:5000/app', tag: 'latest' });
        expect(splitImageRef('ghcr.io/owner/app:v2')).toEqual({ name: 'ghcr.io/owner/app', tag: 'v2' });
    });
});

describe('parseCompose — docker-compose subset', () => {
    it('normalizes a multi-service compose object into a TemplateSpec', () => {
        const spec = parseCompose({
            services: {
                web: {
                    image: 'nginx:latest',
                    environment: { FOO: 'bar' },
                    ports: [80],
                    depends_on: ['db'],
                    expose: { http: true, port: 80 }
                },
                db: {
                    image: 'postgres:16',
                    environment: ['POSTGRES_PASSWORD=secret'],
                    volumes: ['/var/lib/postgresql/data'],
                    kind: 'database',
                    engine: 'postgres'
                }
            }
        });
        expect(Object.keys(spec.services).sort()).toEqual(['db', 'web']);
        expect(spec.services.web.ports).toEqual([{ target: 80, protocol: 'tcp' }]);
        expect(spec.services.web.expose).toEqual({ http: true, port: 80 });
        expect(spec.services.db.environment).toEqual({ POSTGRES_PASSWORD: 'secret' });
        expect(spec.services.db.volumes).toEqual([{ path: '/var/lib/postgresql/data', mode: 'rw' }]);
        expect(spec.services.db.kind).toBe('database');
    });

    it('normalizes a named-volume "name:/path" to the container path only', () => {
        const spec = parseCompose({
            services: { app: { image: 'app', volumes: ['data:/app/data:ro'] } }
        });
        expect(spec.services.app.volumes).toEqual([{ path: '/app/data', mode: 'ro' }]);
    });
});

describe('parseCompose — legacy parent/husband one-click shape', () => {
    const legacy = {
        name: 'n8n',
        image: { name: 'docker.n8n.io/n8nio/n8n', tag: 'latest' },
        ports: [{ protocol: 'tcp', internalPort: 5678 }],
        environment: {
            DB_TYPE: 'postgresdb',
            DB_POSTGRESDB_HOST: '{server_ip}',
            DB_POSTGRESDB_PORT: '${n8n-DB.externalPort}'
        },
        husbands: [{
            name: 'n8n-DB',
            image: { name: 'postgres', tag: 'latest' },
            ports: [{ protocol: 'tcp', internalPort: 5432 }],
            environment: { POSTGRES_USER: 'root' }
        }]
    };

    it('maps the parent to a root service that depends_on the husbands', () => {
        const spec = parseCompose(legacy);
        expect(Object.keys(spec.services).sort()).toEqual(['n8n', 'n8n-DB']);
        expect(spec.services['n8n'].image).toBe('docker.n8n.io/n8nio/n8n:latest');
        expect(spec.services['n8n'].depends_on).toEqual(['n8n-DB']);

        expect(spec.services['n8n'].expose).toEqual({ http: true, port: 5678 });
        expect(spec.services['n8n-DB'].image).toBe('postgres:latest');
        expect(spec.services['n8n-DB'].ports).toEqual([{ target: 5432, protocol: 'tcp' }]);
    });

    it('coerces a numeric legacy tag to a string', () => {
        const spec = parseCompose({ name: 'uk', image: { name: 'louislam/uptime-kuma', tag: 1 } });
        expect(spec.services['uk'].image).toBe('louislam/uptime-kuma:1');
    });
});

describe('parseCompose — security rejections', () => {
    it('rejects a host bind mount', () => {
        expect(() => parseCompose({
            services: { app: { image: 'app', volumes: ['/etc/passwd:/host-passwd'] } }
        })).toThrow(/HostBindMount/);
    });

    it('rejects a long-form bind mount', () => {
        expect(() => parseCompose({
            services: { app: { image: 'app', volumes: [{ type: 'bind', source: '/data', target: '/d' }] } }
        })).toThrow(/HostBindMount/);
    });

    it('rejects privileged', () => {
        expect(() => parseCompose({
            services: { app: { image: 'app', privileged: true } }
        })).toThrow(/Forbidden::privileged/);
    });

    it('rejects network_mode host', () => {
        expect(() => parseCompose({
            services: { app: { image: 'app', network_mode: 'host' } }
        })).toThrow(/Forbidden::network_mode/);
    });

    it('rejects cap_add', () => {
        expect(() => parseCompose({
            services: { app: { image: 'app', cap_add: ['SYS_ADMIN'] } }
        })).toThrow(/Forbidden::cap_add/);
    });

    it('rejects a pinned host port (host:container)', () => {
        expect(() => parseCompose({
            services: { app: { image: 'app', ports: ['8080:80'] } }
        })).toThrow(/HostPort/);
    });

    it('rejects a published host port (long form)', () => {
        expect(() => parseCompose({
            services: { app: { image: 'app', ports: [{ target: 80, published: 8080 }] } }
        })).toThrow(/HostPort/);
    });

    it('rejects a cyclic depends_on', () => {
        expect(() => parseCompose({
            services: {
                a: { image: 'a', depends_on: ['b'] },
                b: { image: 'b', depends_on: ['a'] }
            }
        })).toThrow(/CyclicDependency/);
    });

    it('rejects a depends_on referencing an unknown service', () => {
        expect(() => parseCompose({
            services: { a: { image: 'a', depends_on: ['ghost'] } }
        })).toThrow(/UnknownDependency/);
    });

    it('rejects an empty/unrecognized input', () => {
        expect(() => parseCompose({})).toThrow(/UnrecognizedShape/);
        expect(() => parseCompose(null)).toThrow(/InvalidInput/);
    });
});

describe('topologicalOrder', () => {
    it('orders dependencies before dependents', () => {
        const spec = parseCompose({
            services: {
                web: { image: 'web', depends_on: ['db', 'cache'] },
                db: { image: 'db' },
                cache: { image: 'cache' }
            }
        });
        const order = topologicalOrder(spec);
        expect(order.indexOf('db')).toBeLessThan(order.indexOf('web'));
        expect(order.indexOf('cache')).toBeLessThan(order.indexOf('web'));
    });
});

describe('interpolate.resolveEnv', () => {
    const spec = parseCompose({
        services: {
            app: {
                image: 'app',
                environment: {
                    DB_HOST: '{server_ip}',
                    DB_PORT: '${db.externalPort}',
                    SECRET: '${input.API_KEY}',
                    SELF_URL: 'http://{server_ip}:80'
                },
                ports: [80]
            },
            db: { image: 'postgres', ports: [5432] }
        }
    });

    it('resolves {server_ip}, ${svc.externalPort} and ${input.KEY}', () => {
        const env = resolveEnv(
            spec,
            { API_KEY: 'sk-123' },
            {
                app: { externalPort: 30080, portMap: { 80: 30080 } },
                db: { externalPort: 34567, portMap: { 5432: 34567 } }
            },
            { serverIp: '10.0.0.5' }
        );
        expect(env.app.DB_HOST).toBe('10.0.0.5');
        expect(env.app.DB_PORT).toBe('34567');
        expect(env.app.SECRET).toBe('sk-123');

        expect(env.app.SELF_URL).toBe('http://10.0.0.5:30080');

        expect(env.db).toEqual({});
    });

    it('throws on an unknown service reference', () => {
        const bad = parseCompose({
            services: { app: { image: 'app', environment: { X: '${ghost.externalPort}' } } }
        });
        expect(() => resolveEnv(bad, {}, {}, { serverIp: 'x' })).toThrow(/UnknownService/);
    });

    it('throws on an unknown input reference', () => {
        const bad = parseCompose({
            services: { app: { image: 'app', environment: { X: '${input.MISSING}' } } }
        });
        expect(() => resolveEnv(bad, {}, {}, { serverIp: 'x' })).toThrow(/UnknownInput/);
    });
});
