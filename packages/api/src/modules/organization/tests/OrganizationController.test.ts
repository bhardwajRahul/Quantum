import { describe, expect, it } from 'vitest';
import { useApp, flushEvents, authHeader } from '@tests/harness';
import { request, expectError } from '@tests/request';
import { seed } from '@tests/Seed';
import { organizationRoutes } from '@quantum/contracts/modules/organization/routes';
import { OrganizationRole } from '@quantum/contracts/modules/organization/domain';
import User from '@/modules/user/models/User';
import Organization from '../models/Organization';
import OrganizationMembership from '../models/OrganizationMembership';
import Project from '@/modules/project/models/Project';

const ctx = useApp();

describe('organization', () => {
    it('rejects unauthenticated requests', async () => {
        const res = await request(ctx.app, organizationRoutes.list);

        expectError(res, 401, 'Authentication::Unauthorized');
    });

    it('creates an organization with slug, owner membership and default org', async () => {
        const user = await seed.user();

        const res = await request(ctx.app, organizationRoutes.create, {
            as: user.id,
            body: { name: 'Acme Inc' }
        });

        expect(res.status).toBe(201);
        const org = res.data();
        expect(org.name).toBe('Acme Inc');
        expect(org.slug).toMatch(/^acme-inc-[0-9a-f]{4}$/);
        expect(org.ownerId).toBe(user.id);
        expect(org.isPersonal).toBe(false);

        const membership = await OrganizationMembership.findOneBy({ userId: user.id, organizationId: org.id });
        expect(membership?.role).toBe(OrganizationRole.Owner);

        const updated = await User.findOneBy({ id: user.id });
        expect(updated?.defaultOrganizationId).toBe(org.id);

        const project = await Project.findOneBy({ organizationId: org.id });
        expect(project).toMatchObject({ name: 'Default Project', isDefault: true });

        await flushEvents();
    });

    it('keeps an existing default organization on create', async () => {
        const { user, org } = await seed.orgContext();

        const res = await request(ctx.app, organizationRoutes.create, {
            as: user.id,
            body: { name: 'Second Org' }
        });

        expect(res.status).toBe(201);
        const updated = await User.findOneBy({ id: user.id });
        expect(updated?.defaultOrganizationId).toBe(org.id);

        await flushEvents();
    });

    it('rejects an invalid create body', async () => {
        const user = await seed.user();

        const res = await request(ctx.app, organizationRoutes.create, {
            as: user.id,
            body: { name: 'x'.repeat(65) }
        });

        expectError(res, 400, 'Request::ValidationFailed');
    });

    it('lists only organizations the caller belongs to', async () => {
        const { user, org } = await seed.orgContext();
        await seed.org(await seed.user());

        const res = await request(ctx.app, organizationRoutes.list, { as: user.id });

        expect(res.status).toBe(200);
        expect(res.data()).toHaveLength(1);
        expect(res.data()[0].id).toBe(org.id);
    });

    it('returns the current tenant context', async () => {
        const { user, org } = await seed.orgContext();

        const res = await request(ctx.app, organizationRoutes.current, { as: user.id });

        expect(res.status).toBe(200);
        expect(res.data()).toMatchObject({
            organization: { id: org.id, name: org.name },
            role: OrganizationRole.Owner
        });
    });

    it('updates an organization as owner', async () => {
        const { user, org } = await seed.orgContext();

        const res = await request(ctx.app, organizationRoutes.update, {
            as: user.id,
            params: { id: org.id },
            body: { name: 'Renamed Org' }
        });

        expect(res.status).toBe(200);
        expect(res.data()).toMatchObject({ id: org.id, name: 'Renamed Org' });
    });

    it('forbids update for a member without org:settings', async () => {
        const { org } = await seed.orgContext();
        const member = await seed.member(org);

        const res = await request(ctx.app, organizationRoutes.update, {
            as: member.id,
            params: { id: org.id },
            body: { name: 'Hijacked' }
        });

        expectError(res, 403, 'Tenancy::InsufficientPermissions');
    });

    it('deletes an organization as owner and cascades memberships', async () => {
        const { user, org } = await seed.orgContext();
        await seed.member(org);

        const res = await request(ctx.app, organizationRoutes.remove, {
            as: user.id,
            params: { id: org.id }
        });

        expect(res.status).toBe(204);
        expect(await Organization.findOneBy({ id: org.id })).toBeNull();
        expect(await OrganizationMembership.countBy({ organizationId: org.id })).toBe(0);

        await flushEvents();
    });

    it('forbids delete for a member without org:delete', async () => {
        const { org } = await seed.orgContext();
        const member = await seed.member(org);

        const res = await request(ctx.app, organizationRoutes.remove, {
            as: member.id,
            params: { id: org.id }
        });

        expectError(res, 403, 'Tenancy::InsufficientPermissions');
    });

    it('answers 409 Reconfigure when x-organization-id points to a non-member org', async () => {
        const { org } = await seed.orgContext();
        const outsider = await seed.user();

        const res = await ctx.app.inject({
            method: 'GET',
            url: organizationRoutes.list.path,
            headers: { ...authHeader(outsider.id), 'x-organization-id': String(org.id) }
        });

        expect(res.statusCode).toBe(409);
        expect(res.json()).toMatchObject({ error: 'Tenancy::OrganizationReconfigure' });
    });

    it('answers 409 Reconfigure for an unresolvable x-organization-id header', async () => {
        const outsider = await seed.user();

        const res = await ctx.app.inject({
            method: 'GET',
            url: organizationRoutes.list.path,
            headers: { ...authHeader(outsider.id), 'x-organization-id': 'not-a-number' }
        });

        expect(res.statusCode).toBe(409);
        expect(res.json()).toMatchObject({ error: 'Tenancy::OrganizationReconfigure' });
    });
});

describe('membership', () => {
    it('lists the members of the organization', async () => {
        const { user, org } = await seed.orgContext();
        const member = await seed.member(org);

        const res = await request(ctx.app, organizationRoutes.members, {
            as: user.id,
            params: { orgId: org.id }
        });

        expect(res.status).toBe(200);
        const members = res.data();
        expect(members).toHaveLength(2);
        expect(members.find((entry) => entry.userId === user.id)).toMatchObject({
            username: user.username,
            email: user.email,
            role: OrganizationRole.Owner
        });
        expect(members.find((entry) => entry.userId === member.id)?.role).toBe(OrganizationRole.Member);
    });

    it('forbids the member list for a non-member', async () => {
        const { org } = await seed.orgContext();
        const outsider = await seed.user();

        const res = await request(ctx.app, organizationRoutes.members, {
            as: outsider.id,
            params: { orgId: org.id }
        });

        expectError(res, 403, 'Tenancy::OrganizationForbidden');
    });

    it('invites a member by email', async () => {
        const { user, org } = await seed.orgContext();
        const invitee = await seed.user();

        const res = await request(ctx.app, organizationRoutes.invite, {
            as: user.id,
            params: { orgId: org.id },
            body: { email: invitee.email, role: OrganizationRole.Member }
        });

        expect(res.status).toBe(201);
        expect(res.data()).toMatchObject({ userId: invitee.id, role: OrganizationRole.Member });

        const membership = await OrganizationMembership.findOneBy({ userId: invitee.id, organizationId: org.id });
        expect(membership?.role).toBe(OrganizationRole.Member);
    });

    it('rejects inviting an unknown email', async () => {
        const { user, org } = await seed.orgContext();

        const res = await request(ctx.app, organizationRoutes.invite, {
            as: user.id,
            params: { orgId: org.id },
            body: { email: 'ghost@quantum.test', role: OrganizationRole.Member }
        });

        expectError(res, 404, 'Tenancy::UserNotFound');
    });

    it('rejects a duplicate invite with 409', async () => {
        const { user, org } = await seed.orgContext();
        const invitee = await seed.user();

        await request(ctx.app, organizationRoutes.invite, {
            as: user.id,
            params: { orgId: org.id },
            body: { email: invitee.email, role: OrganizationRole.Member }
        });

        const res = await request(ctx.app, organizationRoutes.invite, {
            as: user.id,
            params: { orgId: org.id },
            body: { email: invitee.email, role: OrganizationRole.Admin }
        });

        expectError(res, 409, 'Tenancy::MembershipAlreadyExists');
    });

    it('forbids invite for a member without member:manage', async () => {
        const { org } = await seed.orgContext();
        const member = await seed.member(org);
        const invitee = await seed.user();

        const res = await request(ctx.app, organizationRoutes.invite, {
            as: member.id,
            params: { orgId: org.id },
            body: { email: invitee.email, role: OrganizationRole.Member }
        });

        expectError(res, 403, 'Tenancy::InsufficientPermissions');
    });

    it('updates a member role', async () => {
        const { user, org } = await seed.orgContext();
        const invitee = await seed.user();

        const invited = await request(ctx.app, organizationRoutes.invite, {
            as: user.id,
            params: { orgId: org.id },
            body: { email: invitee.email, role: OrganizationRole.Member }
        });
        expect(invited.status).toBe(201);

        const res = await request(ctx.app, organizationRoutes.updateMember, {
            as: user.id,
            params: { orgId: org.id, id: invited.data().id },
            body: { role: OrganizationRole.Admin }
        });

        expect(res.status).toBe(200);
        expect(res.data()).toMatchObject({ userId: invitee.id, role: OrganizationRole.Admin });
    });

    it('rejects demoting the owner', async () => {
        const { user, org } = await seed.orgContext();
        const membership = await OrganizationMembership.findOneBy({ userId: user.id, organizationId: org.id });
        if(!membership) throw new Error('seeded owner membership not found');

        const res = await request(ctx.app, organizationRoutes.updateMember, {
            as: user.id,
            params: { orgId: org.id, id: membership.id },
            body: { role: OrganizationRole.Member }
        });

        expectError(res, 400, 'Tenancy::CannotDemoteOwner');
    });

    it('removes a member', async () => {
        const { user, org } = await seed.orgContext();
        const invitee = await seed.user();

        const invited = await request(ctx.app, organizationRoutes.invite, {
            as: user.id,
            params: { orgId: org.id },
            body: { email: invitee.email, role: OrganizationRole.Member }
        });
        expect(invited.status).toBe(201);

        const res = await request(ctx.app, organizationRoutes.removeMember, {
            as: user.id,
            params: { orgId: org.id, id: invited.data().id }
        });

        expect(res.status).toBe(204);
        expect(await OrganizationMembership.findOneBy({ id: invited.data().id })).toBeNull();
    });

    it('rejects removing the owner membership', async () => {
        const { user, org } = await seed.orgContext();
        const membership = await OrganizationMembership.findOneBy({ userId: user.id, organizationId: org.id });
        if(!membership) throw new Error('seeded owner membership not found');

        const res = await request(ctx.app, organizationRoutes.removeMember, {
            as: user.id,
            params: { orgId: org.id, id: membership.id }
        });

        expectError(res, 400, 'Tenancy::CannotRemoveOwner');
    });
});
