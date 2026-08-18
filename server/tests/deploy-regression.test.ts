import { describe, it, expect } from 'vitest';
import crypto from 'crypto';
import { detectBuildStrategy } from '@services/runtime/detect';
import { resolveStrategy, getBuilder } from '@services/build';
import { buildTraefikLabels } from '@services/ingress/labels';

const verifySignature = (
    headerSig: string | undefined,
    rawBody: Buffer | undefined,
    secret: string | undefined
): boolean => {
    if(!secret || !headerSig || !rawBody) return false;
    const expected = 'sha256=' + crypto.createHmac('sha256', secret).update(rawBody).digest('hex');
    const received = Buffer.from(headerSig);
    const computed = Buffer.from(expected);
    return received.length === computed.length && crypto.timingSafeEqual(received, computed);
};

describe('webhook auth — empty/missing SECRET_KEY refuses every payload', () => {
    const body = Buffer.from(JSON.stringify({ pusher: { name: 'x' } }));
    const cookedSignature = (secret: string) =>
        'sha256=' + crypto.createHmac('sha256', secret).update(body).digest('hex');

    it('rejects requests when SECRET_KEY is unset (no hmac key → never auth)', () => {
        const sig = cookedSignature('');
        expect(verifySignature(sig, body, undefined)).toBe(false);
        expect(verifySignature(sig, body, '')).toBe(false);
    });

    it('accepts when a real secret is configured and the signature matches', () => {
        const secret = 'configured-secret';
        expect(verifySignature(cookedSignature(secret), body, secret)).toBe(true);
    });
});

describe('webhook branch filter — push to non-tracked branch must be skipped', () => {
    const shouldDeploy = (trackedBranch: string, pushedRef: string): boolean => {
        if(!pushedRef) return true;
        return pushedRef === `refs/heads/${trackedBranch}`;
    };

    it('deploys when the push ref matches the tracked branch', () => {
        expect(shouldDeploy('main', 'refs/heads/main')).toBe(true);
        expect(shouldDeploy('develop', 'refs/heads/develop')).toBe(true);
    });

    it('skips a push to a non-tracked branch', () => {
        expect(shouldDeploy('main', 'refs/heads/feature-x')).toBe(false);
        expect(shouldDeploy('main', 'refs/tags/v1.0')).toBe(false);
    });
});

describe('build strategy detection — never hands the factory an unimplemented key', () => {
    it('never returns "compose" for a docker-compose file (factory would throw NotYetImplemented)', () => {
        expect(detectBuildStrategy(['docker-compose.yml'])).toBe('exec');
        expect(detectBuildStrategy(['compose.yaml'])).toBe('exec');
    });

    it('every value detectBuildStrategy returns has a working builder in the factory', () => {
        const probes = [
            ['Dockerfile'],
            ['Dockerfile', 'docker-compose.yml'],
            ['docker-compose.yml'],
            ['compose.yaml'],
            ['package.json'],
            ['main.py'],
            []
        ];
        for(const files of probes){
            const strategy = detectBuildStrategy(files);
            expect(() => getBuilder(strategy)).not.toThrow();
        }
    });

    it('resolveStrategy under auto + compose file never returns "compose"', () => {
        const repo: any = { buildStrategy: 'auto' };
        expect(resolveStrategy(repo, ['docker-compose.yml'])).not.toBe('compose');
        expect(resolveStrategy(repo, ['docker-compose.yml'])).toBe('exec');
    });
});

describe('Traefik labels — tls=false domains route via the plain `web` entrypoint', () => {
    const repo: any = { alias: 'my-app', _id: 'x', port: 8080, runtime: 'node' };

    it('emits a plain-HTTP router when ALL domains opt out of TLS', () => {
        const labels = buildTraefikLabels(repo, [
            { host: 'plain.example.com', tls: false } as any
        ]);
        expect(labels['traefik.http.routers.my-app-plain.rule']).toBe('Host(`plain.example.com`)');
        expect(labels['traefik.http.routers.my-app-plain.entrypoints']).toBe('web');
        expect(labels['traefik.http.routers.my-app.rule']).toBeUndefined();
        expect(labels['traefik.http.routers.my-app.tls']).toBeUndefined();
    });

    it('co-routes TLS and plain on the same container when domains mix', () => {
        const labels = buildTraefikLabels(repo, [
            { host: 'secure.example.com', tls: true } as any,
            { host: 'plain.example.com', tls: false } as any
        ]);
        expect(labels['traefik.http.routers.my-app.rule']).toBe('Host(`secure.example.com`)');
        expect(labels['traefik.http.routers.my-app.entrypoints']).toBe('websecure');
        expect(labels['traefik.http.routers.my-app-plain.rule']).toBe('Host(`plain.example.com`)');
        expect(labels['traefik.http.routers.my-app-plain.entrypoints']).toBe('web');
    });

    it('treats tls=undefined as the historical default (TLS on)', () => {
        const labels = buildTraefikLabels(repo, [{ host: 'legacy.example.com' } as any]);
        expect(labels['traefik.http.routers.my-app.rule']).toBe('Host(`legacy.example.com`)');
        expect(labels['traefik.http.routers.my-app.entrypoints']).toBe('websecure');
        expect(labels['traefik.http.routers.my-app.tls']).toBe('true');
    });
});
