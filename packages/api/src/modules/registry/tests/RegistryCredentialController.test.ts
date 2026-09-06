import { describe, expect, it } from 'vitest';
import { useApp } from '@tests/harness';
import { request, expectError } from '@tests/request';
import { seed } from '@tests/Seed';
import { OrganizationRole } from '@quantum/contracts/modules/organization/domain';
import { registryCredentialRoutes } from '@quantum/contracts/modules/registry/routes';
import RegistryCredential from '../models/RegistryCredential';

const ctx = useApp();

const create = (userId: number, orgId: number, body = { registry: 'ghcr.io', username: 'octocat', secret: 'ghp_secret' }) =>
    request(ctx.app, registryCredentialRoutes.create, { as: userId, params: { orgId }, body });

describe('registry credentials', () => {
    it('stores a credential per registry with the secret hidden and the host normalized', async () => {
        const { user, org } = await seed.orgContext();

        const res = await create(user.id, org.id, { registry: 'https://GHCR.io/', username: 'octocat', secret: 'ghp_secret' });

        expect(res.status).toBe(201);
        expect(res.data()).toMatchObject({ organizationId: org.id, registry: 'ghcr.io', username: 'octocat' });
        expect(res.body).not.toContain('ghp_secret');
        expect(res.json()).not.toHaveProperty('data.secretEnc');

        const row = await RegistryCredential.findOneBy({ id: res.data().id });
        expect(row?.secretEnc).toBeDefined();
        expect(row?.secretEnc).not.toBe('ghp_secret');

        const list = await request(ctx.app, registryCredentialRoutes.listByOrganization, { as: user.id, params: { orgId: org.id } });
        expect(list.data().map((credential) => credential.registry)).toEqual(['ghcr.io']);
    });

    it('refuses a second credential for the same registry and an unusable host', async () => {
        const { user, org } = await seed.orgContext();
        await create(user.id, org.id);

        expectError(await create(user.id, org.id), 409, 'RegistryCredential::AlreadyExists');
        expectError(await create(user.id, org.id, { registry: 'not a host', username: 'x', secret: 'y' }), 400, 'RegistryCredential::InvalidRegistry');
        expectError(await create(user.id, org.id, { registry: 'docker.io', username: '', secret: 'y' }), 400, 'RegistryCredential::InvalidRegistry');
    });

    it('lets admins manage credentials but not members, and never another organization', async () => {
        const { user, org } = await seed.orgContext();
        const admin = await seed.member(org, OrganizationRole.Admin);
        const member = await seed.member(org, OrganizationRole.Member);

        expect((await create(admin.id, org.id, { registry: 'docker.io', username: 'a', secret: 'b' })).status).toBe(201);
        expectError(await create(member.id, org.id), 403, 'Tenancy::InsufficientPermissions');

        const outsider = await seed.orgContext();
        expectError(await create(outsider.user.id, org.id), 403, 'Tenancy::OrganizationForbidden');
        expectError(
            await request(ctx.app, registryCredentialRoutes.listByOrganization, { as: outsider.user.id, params: { orgId: org.id } }),
            403,
            'Tenancy::OrganizationForbidden'
        );
        expect(user.id).toBeGreaterThan(0);
    });

    it('removes a credential only for its own organization', async () => {
        const { user, org } = await seed.orgContext();
        const created = await create(user.id, org.id);
        const outsider = await seed.orgContext();

        expectError(
            await request(ctx.app, registryCredentialRoutes.remove, { as: outsider.user.id, params: { id: created.data().id } }),
            403,
            'RegistryCredential::Forbidden'
        );

        const removed = await request(ctx.app, registryCredentialRoutes.remove, { as: user.id, params: { id: created.data().id } });
        expect(removed.status).toBe(204);
        expect(await RegistryCredential.findOneBy({ id: created.data().id })).toBeNull();
    });
});
