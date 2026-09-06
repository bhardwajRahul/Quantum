import { describe, expect, it, vi } from 'vitest';
import { useApp } from '@tests/harness';
import { seed } from '@tests/Seed';
import SecretCipher from '@/shared/services/SecretCipher';
import RegistryCredential from '@/modules/registry/models/RegistryCredential';
import GithubAccount from '@/modules/github/models/GithubAccount';
import { pullImage } from '@/modules/deployment/orchestrator/pullImage';
import type Dockerode from 'dockerode';

useApp();

const fakeDocker = (failure?: string) => {
    const pull = vi.fn(async () => {
        if(failure !== undefined) throw new Error(failure);
        return {};
    });
    const docker = {
        pull,
        modem: { followProgress: (_stream: unknown, done: (error: Error | null) => void) => done(null) }
    } as unknown as Dockerode;
    return { docker, pull };
};

describe('pull image', () => {
    it('pulls anonymously when the organization has no credentials for the registry', async () => {
        const { user, org } = await seed.orgContext();
        const { docker, pull } = fakeDocker();

        await pullImage(docker, 'nginx:alpine', { organizationId: org.id, userId: user.id });

        expect(pull).toHaveBeenCalledWith('nginx:alpine', {});
    });

    it('sends the stored credentials of the matching registry', async () => {
        const { user, org } = await seed.orgContext();
        await RegistryCredential.create({ organizationId: org.id, registry: 'ghcr.io', username: 'octocat', secretEnc: new SecretCipher().encrypt('ghp_token') }).save();
        await RegistryCredential.create({ organizationId: org.id, registry: 'docker.io', username: 'hubber', secretEnc: new SecretCipher().encrypt('hub_token') }).save();
        const { docker, pull } = fakeDocker();

        await pullImage(docker, 'ghcr.io/acme/api:1', { organizationId: org.id, userId: user.id });
        await pullImage(docker, 'library/postgres:16', { organizationId: org.id, userId: user.id });

        expect(pull).toHaveBeenNthCalledWith(1, 'ghcr.io/acme/api:1', {
            authconfig: { username: 'octocat', password: 'ghp_token', serveraddress: 'ghcr.io' }
        });
        expect(pull).toHaveBeenNthCalledWith(2, 'library/postgres:16', {
            authconfig: { username: 'hubber', password: 'hub_token', serveraddress: 'https://index.docker.io/v1/' }
        });
    });

    it('falls back to the connected GitHub account for ghcr.io only', async () => {
        const { user, org } = await seed.orgContext();
        await GithubAccount.create({ userId: user.id, githubId: '42', accessToken: new SecretCipher().encrypt('gho_token'), username: 'octocat', avatarUrl: null }).save();
        const { docker, pull } = fakeDocker();

        await pullImage(docker, 'ghcr.io/acme/api:1', { organizationId: org.id, userId: user.id });
        await pullImage(docker, 'quay.io/acme/api:1', { organizationId: org.id, userId: user.id });

        expect(pull).toHaveBeenNthCalledWith(1, 'ghcr.io/acme/api:1', {
            authconfig: { username: 'octocat', password: 'gho_token', serveraddress: 'ghcr.io' }
        });
        expect(pull).toHaveBeenNthCalledWith(2, 'quay.io/acme/api:1', {});
    });

    it('turns a registry refusal into a message that says where to fix it', async () => {
        const { user, org } = await seed.orgContext();

        await expect(pullImage(fakeDocker('pull access denied for acme/api').docker, 'ghcr.io/acme/api:1', { organizationId: org.id, userId: user.id }))
            .rejects.toThrow('Could not pull ghcr.io/acme/api:1: ghcr.io requires credentials. Manage registry credentials under Settings → Organization.');

        await RegistryCredential.create({ organizationId: org.id, registry: 'ghcr.io', username: 'octocat', secretEnc: new SecretCipher().encrypt('bad') }).save();
        await expect(pullImage(fakeDocker('unauthorized: authentication required').docker, 'ghcr.io/acme/api:1', { organizationId: org.id, userId: user.id }))
            .rejects.toThrow('ghcr.io refused the stored credentials for octocat');

        await expect(pullImage(fakeDocker('connection refused').docker, 'ghcr.io/acme/api:1', { organizationId: org.id, userId: user.id }))
            .rejects.toThrow('connection refused');
    });
});
