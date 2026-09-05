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

    /** A domain that opted out of TLS must not land on the secure entrypoint. */
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

    /**
     * The empty document matters as much as the populated one: the proxy watches this
     * file, so removing the last upstream has to take its router away rather than leave
     * the previous content in place.
     */
    it('empties the document when nothing is published', () => {
        const yaml = renderUpstreamConfig([]);

        expect(yaml).toContain('routers: {}');
        expect(yaml).toContain('services: {}');
        expect(yaml).not.toContain('upstream-');
    });

    /**
     * The rule expression delimits values with backticks, and `JSON.stringify` does not
     * escape those — so a host is validated on the way in and refused here if it somehow
     * still carries one, rather than escaped and hoped over.
     */
    it('refuses to publish a host that could escape the rule', () => {
        expect(isRuleSafeHost('jellyfin.example.com')).toBe(true);
        expect(isRuleSafeHost('*.example.com')).toBe(true);
        expect(isRuleSafeHost('a`)||Host(`b')).toBe(false);
        expect(isRuleSafeHost('a b')).toBe(false);
    });
    /**
     * The redirect used to sit on the entrypoint, which ran before routing — so a host
     * asking for plain HTTP could never be served and an unrouted name got a 301 instead
     * of a 404. Each TLS host now carries its own redirecting router on :80.
     */
    it('gives a TLS host a redirecting router on plain HTTP', () => {
        const yaml = renderUpstreamConfig([route({ tls: true })]);

        expect(yaml).toContain('    upstream-7-plain:');
        expect(yaml).toContain('      entryPoints: [web]');
        expect(yaml).toContain('      middlewares: [to-https]');
    });

    it('leaves a plain host alone, with no redirect back to itself', () => {
        const yaml = renderUpstreamConfig([route({ tls: false })]);

        // The shared middlewares are always declared; what matters is that no router
        // attaches the redirect to a host that asked to be served in the clear.
        expect(yaml).not.toContain('upstream-7-plain');
        expect(yaml).not.toContain('[to-https]');
    });

    /** Both providers reference these by name, so they have to be in every document. */
    it('always publishes the shared middlewares, even with no routes', () => {
        const yaml = renderUpstreamConfig([]);

        expect(yaml).toContain('    to-https:');
        expect(yaml).toContain('        scheme: https');
        expect(yaml).toContain('    strip-api:');
    });
});
