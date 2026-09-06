import { describe, expect, it } from 'vitest';
import { isRuleSafeHost, renderUpstreamConfig } from '@/modules/domain/services/UpstreamRouterFile';

const route = (over: Partial<Parameters<typeof renderUpstreamConfig>[0][number]> = {}) => ({
    id: 7,
    host: 'jellyfin.example.com',
    upstreamUrl: 'http://192.168.1.50:8096',
    tls: true,
    ...over
});

describe('renderUpstreamConfig', () => {
    it('publishes a router and a service for one upstream', () => {
        const yaml = renderUpstreamConfig([route()]);

        expect(yaml).toContain('    upstream-7:');
        expect(yaml).toContain('      rule: "Host(`jellyfin.example.com`)"');
        expect(yaml).toContain('      service: upstream-7');
        expect(yaml).toContain('          - url: "http://192.168.1.50:8096"');
    });

    it('asks for a certificate on the secure entrypoint', () => {
        const yaml = renderUpstreamConfig([route({ tls: true })]);

        expect(yaml).toContain('      entryPoints: [websecure]');
        expect(yaml).toContain('        certResolver: le');
    });

    it('serves a plain route without a certificate', () => {
        const yaml = renderUpstreamConfig([route({ tls: false })]);

        expect(yaml).toContain('      entryPoints: [web]');
        expect(yaml).not.toContain('certResolver');
    });

    it('keeps routers apart when several upstreams are published', () => {
        const yaml = renderUpstreamConfig([route(), route({ id: 9, host: 'grafana.example.com' })]);

        expect(yaml).toContain('    upstream-7:');
        expect(yaml).toContain('    upstream-9:');
        expect(yaml).toContain('Host(`grafana.example.com`)');
    });

    it('empties the document when nothing is published', () => {
        const yaml = renderUpstreamConfig([]);

        expect(yaml).toContain('routers: {}');
        expect(yaml).toContain('services: {}');
        expect(yaml).not.toContain('upstream-');
    });

    it('refuses to publish a host that could escape the rule', () => {
        expect(isRuleSafeHost('jellyfin.example.com')).toBe(true);
        expect(isRuleSafeHost('*.example.com')).toBe(true);
        expect(isRuleSafeHost('a`)||Host(`b')).toBe(false);
        expect(isRuleSafeHost('a b')).toBe(false);
    });
    it('gives a TLS host a redirecting router on plain HTTP', () => {
        const yaml = renderUpstreamConfig([route({ tls: true })]);

        expect(yaml).toContain('    upstream-7-plain:');
        expect(yaml).toContain('      entryPoints: [web]');
        expect(yaml).toContain('      middlewares: [to-https]');
    });

    it('leaves a plain host alone, with no redirect back to itself', () => {
        const yaml = renderUpstreamConfig([route({ tls: false })]);

        expect(yaml).not.toContain('upstream-7-plain');
        expect(yaml).not.toContain('[to-https]');
    });

    it('always publishes the shared middlewares, even with no routes', () => {
        const yaml = renderUpstreamConfig([]);

        expect(yaml).toContain('    to-https:');
        expect(yaml).toContain('        scheme: https');
        expect(yaml).toContain('    strip-api:');
    });
});
