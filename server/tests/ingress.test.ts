import { describe, it, expect } from 'vitest';
import { buildTraefikLabels, sanitizeRouterName, resolveInternalPort } from '@services/ingress/labels';
import { EDGE_NETWORK_NAME } from '@services/docker/network';

const repo = { alias: 'my-app', _id: 'abc123', port: undefined, runtime: 'node' } as any;

describe('buildTraefikLabels (pure Traefik label compiler)', () => {
    it('returns {} when there are no domains (non-ingress containers untouched)', () => {
        expect(buildTraefikLabels(repo, [])).toEqual({});

        expect(buildTraefikLabels(repo, [{ host: '', tls: true } as any])).toEqual({});
    });

    it('emits a Host() rule, websecure entrypoint, and the le cert resolver', () => {
        const labels = buildTraefikLabels(repo, [{ host: 'example.com', tls: true } as any]);
        expect(labels['traefik.enable']).toBe('true');
        expect(labels['traefik.http.routers.my-app.rule']).toBe('Host(`example.com`)');
        expect(labels['traefik.http.routers.my-app.entrypoints']).toBe('websecure');
        expect(labels['traefik.http.routers.my-app.tls.certresolver']).toBe('le');
        expect(labels['traefik.docker.network']).toBe(EDGE_NETWORK_NAME);
    });

    it('ORs multiple hosts into a single router rule', () => {
        const labels = buildTraefikLabels(repo, [
            { host: 'a.com', tls: true } as any,
            { host: 'b.com', tls: true } as any
        ]);
        expect(labels['traefik.http.routers.my-app.rule']).toBe('Host(`a.com`)||Host(`b.com`)');
    });

    it('uses the passed internalPort for the loadbalancer server port', () => {
        const labels = buildTraefikLabels(repo, [{ host: 'example.com', tls: true } as any], 4321);
        expect(labels['traefik.http.services.my-app.loadbalancer.server.port']).toBe('4321');
    });

    it('falls back to the runtime default port when none is passed', () => {

        const labels = buildTraefikLabels(repo, [{ host: 'example.com', tls: true } as any]);
        expect(labels['traefik.http.services.my-app.loadbalancer.server.port']).toBe('3000');
    });

    it('prefers an explicit repository.port over the runtime default', () => {
        const ported = { alias: 'svc', _id: 'x', port: 8080, runtime: 'node' } as any;
        const labels = buildTraefikLabels(ported, [{ host: 'svc.com', tls: true } as any]);
        expect(labels['traefik.http.services.svc.loadbalancer.server.port']).toBe('8080');
    });
});

describe('sanitizeRouterName', () => {
    it('lowercases and strips unsafe characters from the alias', () => {
        expect(sanitizeRouterName({ alias: 'My App!', _id: 'z' } as any)).toBe('my-app');
    });

    it('falls back to the id when there is no alias', () => {
        expect(sanitizeRouterName({ alias: '', _id: 'deadbeef' } as any)).toBe('deadbeef');
    });
});

describe('resolveInternalPort', () => {
    it('returns the explicit port when set', () => {
        expect(resolveInternalPort({ port: 9090, runtime: 'node' } as any)).toBe(9090);
    });

    it('falls back to the runtime default otherwise', () => {
        expect(resolveInternalPort({ port: undefined, runtime: 'static' } as any)).toBe(80);
    });
});
