import { describe, expect, it } from 'vitest';
import { flushEvents, useApp } from '@tests/harness';
import { expectError, request } from '@tests/request';
import { seed } from '@tests/Seed';
import { githubRoutes } from '@quantum/contracts/modules/github/routes';
import { config } from '@/shared/config';
import { eventBus } from '@/shared/events/EventBus';
import SecretCipher from '@/shared/services/SecretCipher';
import GithubAccount from '../models/GithubAccount';
import GithubAccountService from '../services/GithubAccountService';
import OAuthStateService from '../services/OAuthStateService';
import { detectPreset } from '../services/detectPreset';
import type { GithubConnectedPayload, GithubDisconnectedPayload } from '../contracts/domain/events';
import type { GithubUserProfile } from '../contracts/domain/github';

const ctx = useApp();

/**
 * The suite deliberately leaves the OAuth app unset so `NotConfigured` stays
 * covered, so the one case that needs credentials borrows them for its own
 * duration. `config` is `as const`, hence the widening cast.
 */
const withGithubCredentials = async <T>(run: () => Promise<T>): Promise<T> => {
    const github = config.github as { clientId?: string; clientSecret?: string };
    const previous = { ...github };

    Object.assign(github, { clientId: 'test-client-id', clientSecret: 'test-client-secret' });
    try{
        return await run();
    }finally{
        Object.assign(github, previous);
    }
};

const GITHUB_PROFILE: GithubUserProfile = {
    id: 42,
    login: 'octocat',
    avatar_url: 'https://avatars.githubusercontent.com/u/42',
    name: 'The Octocat'
};

describe('github account', () => {
    it('rejects unauthenticated account requests', async () => {
        const res = await request(ctx.app, githubRoutes.account);

        expectError(res, 401, 'Authentication::Unauthorized');
    });

    it('answers 404 NotConnected when getting the account without a connection', async () => {
        const user = await seed.user();

        const res = await request(ctx.app, githubRoutes.account, { as: user.id });

        expectError(res, 404, 'Github::NotConnected');
    });

    it('answers 404 NotConnected when listing repositories without a connection', async () => {
        const user = await seed.user();

        const res = await request(ctx.app, githubRoutes.repositories, { as: user.id });

        expectError(res, 404, 'Github::NotConnected');
    });

    it('answers 404 NotConnected when detecting without a connection', async () => {
        const user = await seed.user();

        const res = await request(ctx.app, githubRoutes.detect, {
            as: user.id,
            params: { owner: 'octocat', repo: 'hello-world' }
        });

        expectError(res, 404, 'Github::NotConnected');
    });

    it('returns the connected account without the access token', async () => {
        const user = await seed.user();
        await new GithubAccountService().upsertFromGithub(user.id, GITHUB_PROFILE, 'gh-secret-token');

        const res = await request(ctx.app, githubRoutes.account, { as: user.id });

        expect(res.status).toBe(200);
        expect(res.data()).toMatchObject({
            userId: user.id,
            githubId: '42',
            username: 'octocat',
            avatarUrl: 'https://avatars.githubusercontent.com/u/42'
        });
        expect(res.body).not.toContain('gh-secret-token');
        expect(res.body).not.toContain('accessToken');

        await flushEvents();
    });
});

describe('github oauth', () => {
    it('rejects an unauthenticated oauth start', async () => {
        const res = await request(ctx.app, githubRoutes.oauthStart);

        expectError(res, 401, 'Authentication::Unauthorized');
    });

    it('answers the authorize URL on oauth start, with a state bound to the caller', async () => {
        const user = await seed.user();

        const res = await withGithubCredentials(() => request(ctx.app, githubRoutes.oauthStart, { as: user.id }));

        expect(res.status).toBe(200);

        const { url } = res.data();
        const authorize = new URL(url);
        expect(`${authorize.origin}${authorize.pathname}`).toBe('https://github.com/login/oauth/authorize');
        expect(authorize.searchParams.get('client_id')).toBe('test-client-id');

        // Not a redirect: a top-level navigation could not have authenticated this route.
        expect(res.json<Record<string, unknown>>()).toHaveProperty('data');

        const state = authorize.searchParams.get('state') ?? '';
        expect(new OAuthStateService().consume(state)).toBe(user.id);
    });

    it('answers 500 NotConfigured on oauth start when credentials are missing', async () => {
        const user = await seed.user();

        const res = await request(ctx.app, githubRoutes.oauthStart, { as: user.id });

        expectError(res, 500, 'Github::NotConfigured');
    });

    it('answers 401 StateMismatch when the callback state is missing', async () => {
        const res = await request(ctx.app, githubRoutes.oauthCallback, { query: { code: 'code' } });

        expectError(res, 401, 'Github::StateMismatch');
    });

    it('answers 401 StateMismatch when the callback state is forged', async () => {
        const res = await request(ctx.app, githubRoutes.oauthCallback, {
            query: { code: 'code', state: 'forged-state' }
        });

        expectError(res, 401, 'Github::StateMismatch');
    });

    it('binds the oauth state to the authenticated user', () => {
        const state = new OAuthStateService().issue(7);

        expect(new OAuthStateService().consume(state)).toBe(7);
    });
});

describe('github token storage', () => {
    it('stores the access token as AES-GCM ciphertext and decrypts it on demand', async () => {
        const user = await seed.user();
        await new GithubAccountService().upsertFromGithub(user.id, GITHUB_PROFILE, 'gh-secret-token');

        const stored = await GithubAccount.findOneBy({ userId: user.id });
        if(stored === null) throw new Error('expected a stored github account');

        expect(stored.accessToken).not.toBe('gh-secret-token');
        expect(stored.accessToken.split(':')).toHaveLength(3);
        expect(new SecretCipher().decrypt(stored.accessToken)).toBe('gh-secret-token');

        await flushEvents();
    });

    it('replaces the existing account on reconnect', async () => {
        const user = await seed.user();
        const service = new GithubAccountService();
        await service.upsertFromGithub(user.id, GITHUB_PROFILE, 'first-token');
        await service.upsertFromGithub(user.id, { ...GITHUB_PROFILE, login: 'renamed' }, 'second-token');

        const accounts = await GithubAccount.findBy({ userId: user.id });
        expect(accounts).toHaveLength(1);
        expect(accounts[0].username).toBe('renamed');
        expect(new SecretCipher().decrypt(accounts[0].accessToken)).toBe('second-token');

        await flushEvents();
    });

    it('emits github.connected and github.disconnected', async () => {
        const user = await seed.user();
        const connected: GithubConnectedPayload[] = [];
        const disconnected: GithubDisconnectedPayload[] = [];
        eventBus.subscribe('github.connected', (payload) => { connected.push(payload as GithubConnectedPayload); });
        eventBus.subscribe('github.disconnected', (payload) => { disconnected.push(payload as GithubDisconnectedPayload); });

        const service = new GithubAccountService();
        await service.upsertFromGithub(user.id, GITHUB_PROFILE, 'gh-secret-token');
        await service.removeForUser(user.id);
        await flushEvents();

        expect(connected).toEqual([{ userId: user.id, username: 'octocat' }]);
        expect(disconnected).toEqual([{ userId: user.id }]);
    });
});

describe('detectPreset', () => {
    it('detects Next.js from dependencies', () => {
        const preset = detectPreset([], { dependencies: { next: '14.0.0' } });

        expect(preset.framework).toBe('Next.js');
        expect(preset.runtime).toBe('node');
        expect(preset.startCommand).toBe('npm run start');
    });

    it('detects Vite from devDependencies', () => {
        const preset = detectPreset([], { devDependencies: { vite: '5.0.0' } });

        expect(preset.framework).toBe('Vite');
        expect(preset.port).toBe(4173);
    });

    it('falls back to generic Node for an unknown package.json', () => {
        const preset = detectPreset([], { dependencies: { express: '4' }, scripts: { build: 'tsc' } });

        expect(preset.framework).toBe('Node');
        expect(preset.buildCommand).toBe('npm run build');
    });

    it('detects Python from requirements.txt', () => {
        const preset = detectPreset(['requirements.txt', 'app.py'], null);

        expect(preset.runtime).toBe('python');
        expect(preset.startCommand).toBe('python app.py');
    });

    it('detects Go from go.mod', () => {
        const preset = detectPreset(['go.mod'], null);

        expect(preset.runtime).toBe('go');
        expect(preset.startCommand).toBe('./app');
    });

    it('detects a static site from index.html', () => {
        const preset = detectPreset(['index.html'], null);

        expect(preset.runtime).toBe('static');
        expect(preset.port).toBe(80);
    });

    it('defaults to Node when nothing matches', () => {
        const preset = detectPreset([], null);

        expect(preset.framework).toBe('Node');
    });
});
