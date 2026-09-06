import { describe, expect, it } from 'vitest';
import { composeToSpec } from '../services/composeSpec';

const compose = (body: string): string => `services:\n${body}`;

describe('compose to spec', () => {
    it('maps image, command, environment, ports, volumes and depends_on', () => {
        const spec = composeToSpec(compose(`
  web:
    image: nginx:1.27
    command: ["nginx", "-g", "daemon off;"]
    environment:
      - API_URL=http://api:9000
      - EMPTY
    ports:
      - "8080:80"
      - 443
      - "127.0.0.1:9443:8443/udp"
    volumes:
      - assets:/usr/share/nginx/html:ro
      - /var/cache/nginx
    depends_on:
      - api
  api:
    image: ghcr.io/acme/api:latest
    environment:
      PORT: 9000
      DEBUG: null
    ports:
      - target: 9000
        published: 19000
        protocol: tcp
    volumes:
      - type: volume
        source: data
        target: /data
        read_only: true
`));

        expect(spec.services.web).toEqual({
            image: 'nginx:1.27',
            command: "nginx -g 'daemon off;'",
            environment: { API_URL: 'http://api:9000', EMPTY: '' },
            ports: [{ target: 80, protocol: undefined }, { target: 443 }, { target: 8443, protocol: 'udp' }],
            volumes: [{ path: '/usr/share/nginx/html', mode: 'ro' }, { path: '/var/cache/nginx' }],
            depends_on: ['api'],
            kind: 'app'
        });
        expect(spec.services.api).toEqual({
            image: 'ghcr.io/acme/api:latest',
            command: undefined,
            environment: { PORT: '9000', DEBUG: '' },
            ports: [{ target: 9000, protocol: 'tcp' }],
            volumes: [{ path: '/data', mode: 'ro' }],
            depends_on: undefined,
            kind: 'app'
        });
    });

    it('accepts the mapping form of depends_on', () => {
        const spec = composeToSpec(compose(`
  db:
    image: postgres:16
  app:
    image: app:1
    depends_on:
      db:
        condition: service_healthy
`));

        expect(spec.services.app.depends_on).toEqual(['db']);
    });

    it('rejects a file that is not a services mapping', () => {
        expect(() => composeToSpec('just a string')).toThrow('TemplateInstall::InvalidCompose:document');
        expect(() => composeToSpec('version: "3"\n')).toThrow('TemplateInstall::InvalidCompose:services');
        expect(() => composeToSpec('services: {}')).toThrow('TemplateInstall::InvalidCompose:services');
    });

    it('names the offending service when yaml, image or depends_on are wrong', () => {
        expect(() => composeToSpec('services:\n  web:\n    image: [')).toThrow('TemplateInstall::InvalidCompose:yaml:');
        expect(() => composeToSpec(compose('  web:\n    ports:\n      - 80'))).toThrow('TemplateInstall::InvalidCompose:image:web');
        expect(() => composeToSpec(compose('  web:\n    image: nginx\n    depends_on: [ghost]')))
            .toThrow('TemplateInstall::InvalidCompose:depends_on:web:ghost');
        expect(() => composeToSpec(compose('  web:\n    image: nginx\n    ports:\n      - "8080:70000"')))
            .toThrow('TemplateInstall::InvalidCompose:ports:web:70000');
    });

    it('refuses what the platform cannot honour: build contexts and host bind mounts', () => {
        expect(() => composeToSpec(compose('  web:\n    build: .\n    image: web')))
            .toThrow('TemplateInstall::UnsupportedCompose:build:web');
        expect(() => composeToSpec(compose('  web:\n    image: nginx\n    volumes:\n      - ./site:/usr/share/nginx/html')))
            .toThrow('TemplateInstall::UnsupportedCompose:bind-mount:web:./site');
        expect(() => composeToSpec(compose('  web:\n    image: nginx\n    volumes:\n      - type: bind\n        source: /etc/x\n        target: /x')))
            .toThrow('TemplateInstall::UnsupportedCompose:bind-mount:web:/etc/x');
    });
});
