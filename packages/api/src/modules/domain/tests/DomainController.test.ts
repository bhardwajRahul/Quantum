import { beforeAll, describe, expect, it } from 'vitest';
import { useApp, flushEvents } from '@tests/harness';
import { request, expectError } from '@tests/request';
import { seed } from '@tests/Seed';
import { eventBus } from '@/shared/events/EventBus';
import Repository from '@/modules/repository/models/Repository';
import { domainRoutes } from '@quantum/contracts/modules/domain/routes';
import { DomainKind, DomainStatus } from '@quantum/contracts/modules/domain/domain';
import { OrganizationRole } from '@quantum/contracts/modules/organization/domain';
import { UserRole } from '@quantum/contracts/modules/user/domain';
import Domain from '../models/Domain';

const ctx = useApp();

const createdEvents: Array<{ domainId: number; repositoryId: number }> = [];
const deletedEvents: Array<{ domainId: number; repositoryId: number }> = [];

let repositorySequence = 0;

const insertRepository = async (organizationId: number, projectId: number, userId: number): Promise<number> => {
    repositorySequence += 1;
    const repository = await Repository.create({
        name: `Repo ${repositorySequence}`,
        alias: `repo-${repositorySequence}`,
        url: `https://git.example.com/repo-${repositorySequence}.git`,
        organizationId,
        projectId,
        userId
    }).save();
    return repository.id;
};

const createDomain = (userId: number, repositoryId: number, host: string) =>
    request(ctx.app, domainRoutes.create, { as: userId, params: { repositoryId }, body: { host } });

beforeAll(() => {
    eventBus.subscribe('domain.created', (payload) => {
        createdEvents.push(payload as { domainId: number; repositoryId: number });
    });
    eventBus.subscribe('domain.deleted', (payload) => {
        deletedEvents.push(payload as { domainId: number; repositoryId: number });
    });
});

describe('domain', () => {
    it('rejects unauthenticated requests', async () => {
        const res = await request(ctx.app, domainRoutes.listByRepository, { params: { repositoryId: 1 } });

        expectError(res, 401, 'Authentication::Unauthorized');
    });

    it('creates a domain under a repository', async () => {
        const { user, org, project } = await seed.orgContext();
        const repositoryId = await insertRepository(org.id, project.id, user.id);

        const res = await createDomain(user.id, repositoryId, '  MyApp.Example.com ');

        expect(res.status).toBe(201);
        expect(res.data()).toMatchObject({
            host: 'myapp.example.com',
            repositoryId,
            organizationId: org.id,
            projectId: project.id,
            userId: user.id,
            kind: DomainKind.Custom,
            isPrimary: true,
            tls: true,
            status: DomainStatus.Pending
        });

        await flushEvents();
        expect(createdEvents.some((event) => event.domainId === res.data().id && event.repositoryId === repositoryId)).toBe(true);
    });

    it('defaults isPrimary only for the first domain of a repository', async () => {
        const { user, org, project } = await seed.orgContext();
        const repositoryId = await insertRepository(org.id, project.id, user.id);
        await createDomain(user.id, repositoryId, 'first.example.com');

        const second = await createDomain(user.id, repositoryId, 'second.example.com');
        expect(second.data().isPrimary).toBe(false);

        const third = await request(ctx.app, domainRoutes.create, {
            as: user.id,
            params: { repositoryId },
            body: { host: 'third.example.com', isPrimary: true, tls: false }
        });
        expect(third.data()).toMatchObject({ isPrimary: true, tls: false });

        await flushEvents();
    });

    it('rejects a duplicate host with 409', async () => {
        const { user, org, project } = await seed.orgContext();
        const repositoryId = await insertRepository(org.id, project.id, user.id);
        await createDomain(user.id, repositoryId, 'taken.example.com');

        const res = await createDomain(user.id, repositoryId, 'taken.example.com');

        expectError(res, 409, 'Domain::AlreadyExists');
    });

    it('rejects an invalid create body', async () => {
        const { user, org, project } = await seed.orgContext();
        const repositoryId = await insertRepository(org.id, project.id, user.id);

        const res = await request(ctx.app, domainRoutes.create, {
            as: user.id,
            params: { repositoryId },
            body: { host: 'ab' }
        });

        expectError(res, 400, 'Request::ValidationFailed');
    });

    it('forbids create for a viewer', async () => {
        const { user, org, project } = await seed.orgContext(OrganizationRole.Viewer);
        const repositoryId = await insertRepository(org.id, project.id, user.id);

        const res = await createDomain(user.id, repositoryId, 'denied.example.com');

        expectError(res, 403, 'Tenancy::InsufficientPermissions');
    });

    it('allows create for a member', async () => {
        const { user, org, project } = await seed.orgContext(OrganizationRole.Member);
        const repositoryId = await insertRepository(org.id, project.id, user.id);

        const res = await createDomain(user.id, repositoryId, 'member.example.com');

        expect(res.status).toBe(201);
        await flushEvents();
    });

    it('answers 404 for an unknown repository', async () => {
        const { user } = await seed.orgContext();

        const res = await createDomain(user.id, 999999, 'ghost.example.com');

        expectError(res, 404, 'Domain::NotFound:Repository');
    });

    it('forbids create on a repository of another organization', async () => {
        const owner = await seed.orgContext();
        const outsider = await seed.orgContext();
        const repositoryId = await insertRepository(owner.org.id, owner.project.id, owner.user.id);

        const res = await createDomain(outsider.user.id, repositoryId, 'foreign.example.com');

        expectError(res, 403, 'Domain::Forbidden:Repository');
    });

    it('lists domains scoped to the repository', async () => {
        const { user, org, project } = await seed.orgContext();
        const repositoryId = await insertRepository(org.id, project.id, user.id);
        await createDomain(user.id, repositoryId, 'one.example.com');
        await createDomain(user.id, repositoryId, 'two.example.com');

        const other = await seed.orgContext();
        const otherRepositoryId = await insertRepository(other.org.id, other.project.id, other.user.id);
        await createDomain(other.user.id, otherRepositoryId, 'elsewhere.example.com');

        const res = await request(ctx.app, domainRoutes.listByRepository, {
            as: user.id,
            params: { repositoryId }
        });

        expect(res.status).toBe(200);
        expect(res.data()).toHaveLength(2);
        for(const domain of res.data()){
            expect(domain.repositoryId).toBe(repositoryId);
        }

        await flushEvents();
    });

    it('forbids listing domains of a foreign repository', async () => {
        const owner = await seed.orgContext();
        const outsider = await seed.orgContext();
        const repositoryId = await insertRepository(owner.org.id, owner.project.id, owner.user.id);

        const res = await request(ctx.app, domainRoutes.listByRepository, {
            as: outsider.user.id,
            params: { repositoryId }
        });

        expectError(res, 403, 'Domain::Forbidden:Repository');
    });

    it('gets a domain as a member', async () => {
        const { user, org, project } = await seed.orgContext();
        const repositoryId = await insertRepository(org.id, project.id, user.id);
        const created = await createDomain(user.id, repositoryId, 'readable.example.com');

        const res = await request(ctx.app, domainRoutes.get, {
            as: user.id,
            params: { id: created.data().id }
        });

        expect(res.status).toBe(200);
        expect(res.data()).toMatchObject({ id: created.data().id, host: 'readable.example.com' });
    });

    it('forbids getting a domain of another organization', async () => {
        const owner = await seed.orgContext();
        const outsider = await seed.orgContext();
        const repositoryId = await insertRepository(owner.org.id, owner.project.id, owner.user.id);
        const created = await createDomain(owner.user.id, repositoryId, 'private.example.com');

        const res = await request(ctx.app, domainRoutes.get, {
            as: outsider.user.id,
            params: { id: created.data().id }
        });

        expectError(res, 403, 'Domain::Forbidden');
    });

    it('answers 404 for an unknown domain', async () => {
        const { user } = await seed.orgContext();

        const res = await request(ctx.app, domainRoutes.get, {
            as: user.id,
            params: { id: 999999 }
        });

        expectError(res, 404, 'Domain::NotFound');
    });

    it('lets a platform admin bypass domain ownership', async () => {
        const { org, project, user } = await seed.orgContext();
        const repositoryId = await insertRepository(org.id, project.id, user.id);
        const created = await createDomain(user.id, repositoryId, 'admin-visible.example.com');
        const admin = await seed.user(UserRole.Admin);

        const res = await request(ctx.app, domainRoutes.get, {
            as: admin.id,
            params: { id: created.data().id }
        });

        expect(res.status).toBe(200);
        expect(res.data()).toMatchObject({ id: created.data().id });
    });

    it('updates the mutable fields of a domain', async () => {
        const { user, org, project } = await seed.orgContext();
        const repositoryId = await insertRepository(org.id, project.id, user.id);
        const created = await createDomain(user.id, repositoryId, 'mutable.example.com');

        const res = await request(ctx.app, domainRoutes.update, {
            as: user.id,
            params: { id: created.data().id },
            body: { isPrimary: true, tls: false, status: DomainStatus.Active }
        });

        expect(res.status).toBe(200);
        expect(res.data()).toMatchObject({
            id: created.data().id,
            host: 'mutable.example.com',
            isPrimary: true,
            tls: false,
            status: DomainStatus.Active
        });
    });

    it('forbids update for a viewer', async () => {
        const { user, org, project } = await seed.orgContext(OrganizationRole.Viewer);
        const repositoryId = await insertRepository(org.id, project.id, user.id);
        const created = await request(ctx.app, domainRoutes.create, {
            as: (await seed.member(org, OrganizationRole.Member)).id,
            params: { repositoryId },
            body: { host: 'locked.example.com' }
        });

        const res = await request(ctx.app, domainRoutes.update, {
            as: user.id,
            params: { id: created.data().id },
            body: { isPrimary: true }
        });

        expectError(res, 403, 'Tenancy::InsufficientPermissions');
    });

    it('deletes a domain', async () => {
        const { user, org, project } = await seed.orgContext();
        const repositoryId = await insertRepository(org.id, project.id, user.id);
        const created = await createDomain(user.id, repositoryId, 'doomed.example.com');

        const res = await request(ctx.app, domainRoutes.remove, {
            as: user.id,
            params: { id: created.data().id }
        });

        expect(res.status).toBe(204);
        expect(await Domain.findOneBy({ id: created.data().id })).toBeNull();

        await flushEvents();
        expect(deletedEvents.some((event) => event.domainId === created.data().id && event.repositoryId === repositoryId)).toBe(true);
    });

    it('forbids delete for a viewer', async () => {
        const { user, org, project } = await seed.orgContext(OrganizationRole.Viewer);
        const repositoryId = await insertRepository(org.id, project.id, user.id);
        const created = await request(ctx.app, domainRoutes.create, {
            as: (await seed.member(org, OrganizationRole.Member)).id,
            params: { repositoryId },
            body: { host: 'protected.example.com' }
        });

        const res = await request(ctx.app, domainRoutes.remove, {
            as: user.id,
            params: { id: created.data().id }
        });

        expectError(res, 403, 'Tenancy::InsufficientPermissions');
    });
});
