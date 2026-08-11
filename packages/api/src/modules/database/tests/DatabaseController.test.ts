import { beforeAll, describe, expect, it } from 'vitest';
import { useApp, flushEvents } from '@tests/harness';
import { request, expectError, route } from '@tests/request';
import { seed } from '@tests/Seed';
import { eventBus } from '@/shared/events/EventBus';
import SecretCipher from '@/shared/services/SecretCipher';
import { databaseRoutes } from '@quantum/contracts/modules/database/routes';
import { DatabaseEngine, DatabaseStatus } from '@quantum/contracts/modules/database/domain';
import { OrganizationRole } from '@quantum/contracts/modules/organization/domain';
import { UserRole } from '@quantum/contracts/modules/user/domain';
import Database from '../models/Database';
import DatabaseService from '../services/DatabaseService';
import type { DatabaseCredentials } from '@quantum/contracts/modules/database/domain';
import type { DatabaseProvisionRequestedPayload } from '../contracts/domain/events';

const ctx = useApp();

const provisionEvents: DatabaseProvisionRequestedPayload[] = [];

const createDatabase = (userId: number, projectId: number, name: string, engine: DatabaseEngine = DatabaseEngine.Postgres) =>
    request(ctx.app, databaseRoutes.create, { as: userId, params: { projectId }, body: { name, engine } });

beforeAll(() => {
    eventBus.subscribe('database.provisionRequested', (payload) => {
        provisionEvents.push(payload as DatabaseProvisionRequestedPayload);
    });
});

describe('database', () => {
    it('rejects unauthenticated requests', async () => {
        const res = await request(ctx.app, databaseRoutes.listByProject, { params: { projectId: 1 } });

        expectError(res, 401, 'Authentication::Unauthorized');
    });

    it('creates a database with defaults and keeps secrets hidden', async () => {
        const { user, org, project } = await seed.orgContext();

        const res = await createDatabase(user.id, project.id, '  orders ');

        expect(res.status).toBe(202);
        expect(res.data()).toMatchObject({
            name: 'orders',
            engine: DatabaseEngine.Postgres,
            version: '16-alpine',
            organizationId: org.id,
            projectId: project.id,
            nodeId: 'local',
            status: DatabaseStatus.Pending,
            backups: []
        });
        expect(res.json()).not.toHaveProperty('data.credentialsEnc');
        expect(res.json()).not.toHaveProperty('data.connectionStringEnc');

        await flushEvents();
        expect(provisionEvents.some((event) =>
            event.databaseId === res.data().id && event.action === 'create' && event.userId === user.id
        )).toBe(true);
    });

    it('rejects an unknown engine', async () => {
        const { user, project } = await seed.orgContext();

        const res = await request(ctx.app, route('POST', '/database/project/:projectId'), {
            as: user.id,
            params: { projectId: project.id },
            body: { name: 'bad', engine: 'oracle' }
        });

        expectError(res, 400, 'Request::ValidationFailed');
    });

    it('rejects an empty name', async () => {
        const { user, project } = await seed.orgContext();

        const res = await request(ctx.app, databaseRoutes.create, {
            as: user.id,
            params: { projectId: project.id },
            body: { name: '', engine: DatabaseEngine.Postgres }
        });

        expectError(res, 400, 'Request::ValidationFailed');
    });

    it('rejects a duplicate name within a project with 409', async () => {
        const { user, org, project } = await seed.orgContext();
        await createDatabase(user.id, project.id, 'billing');

        const duplicate = await createDatabase(user.id, project.id, 'billing');
        expectError(duplicate, 409, 'Database::NameAlreadyTaken');

        const otherProject = await seed.project(org);
        const reused = await createDatabase(user.id, otherProject.id, 'billing');
        expect(reused.status).toBe(202);

        await flushEvents();
    });

    it('forbids create for a viewer', async () => {
        const { user, project } = await seed.orgContext(OrganizationRole.Viewer);

        const res = await createDatabase(user.id, project.id, 'denied');

        expectError(res, 403, 'Tenancy::InsufficientPermissions');
    });

    it('allows create for an org admin', async () => {
        const { org, project } = await seed.orgContext();
        const admin = await seed.member(org, OrganizationRole.Admin);

        const res = await createDatabase(admin.id, project.id, 'admin-db');

        expect(res.status).toBe(202);
        await flushEvents();
    });

    it('forbids create for a member without project:write', async () => {
        const { user, project } = await seed.orgContext(OrganizationRole.Member);

        const res = await createDatabase(user.id, project.id, 'member-db');

        expectError(res, 403, 'Tenancy::InsufficientPermissions');
    });

    it('answers 404 for an unknown project', async () => {
        const { user } = await seed.orgContext();

        const res = await createDatabase(user.id, 999999, 'ghost');

        expectError(res, 404, 'Database::NotFound:Project');
    });

    it('forbids create on a project of another organization', async () => {
        const outsider = await seed.orgContext();
        const owner = await seed.orgContext();

        const res = await createDatabase(outsider.user.id, owner.project.id, 'foreign');

        expectError(res, 403, 'Database::Forbidden:Project');
    });

    it('lists databases scoped to the project', async () => {
        const { user, org, project } = await seed.orgContext();
        await createDatabase(user.id, project.id, 'first');
        await createDatabase(user.id, project.id, 'second');

        const otherProject = await seed.project(org);
        await createDatabase(user.id, otherProject.id, 'elsewhere');

        const res = await request(ctx.app, databaseRoutes.listByProject, {
            as: user.id,
            params: { projectId: project.id }
        });

        expect(res.status).toBe(200);
        expect(res.data()).toHaveLength(2);
        for(const database of res.data()){
            expect(database.projectId).toBe(project.id);
        }

        await flushEvents();
    });

    it('forbids listing databases of a foreign project', async () => {
        const owner = await seed.orgContext();
        const outsider = await seed.orgContext();

        const res = await request(ctx.app, databaseRoutes.listByProject, {
            as: outsider.user.id,
            params: { projectId: owner.project.id }
        });

        expectError(res, 403, 'Database::Forbidden:Project');
    });

    it('gets a database as a member', async () => {
        const { user, project } = await seed.orgContext();
        const created = await createDatabase(user.id, project.id, 'readable');

        const res = await request(ctx.app, databaseRoutes.get, {
            as: user.id,
            params: { id: created.data().id }
        });

        expect(res.status).toBe(200);
        expect(res.data()).toMatchObject({ id: created.data().id, name: 'readable' });
    });

    it('forbids getting a database of another organization', async () => {
        const owner = await seed.orgContext();
        const outsider = await seed.orgContext();
        const created = await createDatabase(owner.user.id, owner.project.id, 'private');

        const res = await request(ctx.app, databaseRoutes.get, {
            as: outsider.user.id,
            params: { id: created.data().id }
        });

        expectError(res, 403, 'Database::Forbidden');
    });

    it('answers 404 for an unknown database', async () => {
        const { user } = await seed.orgContext();

        const res = await request(ctx.app, databaseRoutes.get, {
            as: user.id,
            params: { id: 999999 }
        });

        expectError(res, 404, 'Database::NotFound');
    });

    it('lets a platform admin bypass database ownership', async () => {
        const owner = await seed.orgContext();
        const created = await createDatabase(owner.user.id, owner.project.id, 'admin-visible');
        const admin = await seed.user(UserRole.Admin);

        const res = await request(ctx.app, databaseRoutes.get, {
            as: admin.id,
            params: { id: created.data().id }
        });

        expect(res.status).toBe(200);
        expect(res.data()).toMatchObject({ id: created.data().id });
    });

    it('returns a connection string built from the generated credentials', async () => {
        const { user, project } = await seed.orgContext();
        const created = await createDatabase(user.id, project.id, 'billing');

        const res = await request(ctx.app, databaseRoutes.connectionString, {
            as: user.id,
            params: { id: created.data().id }
        });

        expect(res.status).toBe(200);

        const row = await Database.findOneByOrFail({ id: created.data().id });
        if(row.credentialsEnc === null) throw new Error('credentials missing');

        const credentials = JSON.parse(new SecretCipher().decrypt(row.credentialsEnc)) as DatabaseCredentials;
        const connectionString = res.data().connectionString;
        expect(connectionString).toContain(credentials.username);
        expect(connectionString).toContain(credentials.password);
        expect(connectionString).toMatch(/^postgresql:\/\//);
        expect(connectionString).toContain(`:${credentials.port}/`);
    });

    it('forbids the connection string for a viewer', async () => {
        const { org, project } = await seed.orgContext();
        const viewer = await seed.member(org, OrganizationRole.Viewer);
        const writer = await seed.member(org, OrganizationRole.Admin);
        const created = await createDatabase(writer.id, project.id, 'sealed');

        const res = await request(ctx.app, databaseRoutes.connectionString, {
            as: viewer.id,
            params: { id: created.data().id }
        });

        expectError(res, 403, 'Tenancy::InsufficientPermissions');
    });

    it('requests a backup through the provision event', async () => {
        const { user, project } = await seed.orgContext();
        const created = await createDatabase(user.id, project.id, 'backed-up');

        const res = await request(ctx.app, databaseRoutes.backup, {
            as: user.id,
            params: { id: created.data().id }
        });

        expect(res.status).toBe(202);

        await flushEvents();
        const event = provisionEvents.find((candidate) => candidate.databaseId === created.data().id && candidate.action === 'backup');
        expect(event).toBeDefined();
        expect(event?.userId).toBe(user.id);
    });

    it('requests a restore through the provision event', async () => {
        const { user, project } = await seed.orgContext();
        const created = await createDatabase(user.id, project.id, 'restored');

        const res = await request(ctx.app, databaseRoutes.restore, {
            as: user.id,
            params: { id: created.data().id },
            body: { backupId: 'backup-1' }
        });

        expect(res.status).toBe(202);

        await flushEvents();
        const event = provisionEvents.find((candidate) => candidate.databaseId === created.data().id && candidate.action === 'restore');
        expect(event).toBeDefined();
        expect(event?.backupId).toBe('backup-1');
    });

    it('rejects a restore without a backupId', async () => {
        const { user, project } = await seed.orgContext();
        const created = await createDatabase(user.id, project.id, 'no-backup-id');

        const res = await request(ctx.app, route('POST', '/database/:id/restore'), {
            as: user.id,
            params: { id: created.data().id },
            body: {}
        });

        expectError(res, 400, 'Request::ValidationFailed');
    });

    it('forbids backup for a viewer', async () => {
        const { org, project } = await seed.orgContext();
        const viewer = await seed.member(org, OrganizationRole.Viewer);
        const writer = await seed.member(org, OrganizationRole.Admin);
        const created = await createDatabase(writer.id, project.id, 'no-deploy');

        const res = await request(ctx.app, databaseRoutes.backup, {
            as: viewer.id,
            params: { id: created.data().id }
        });

        expectError(res, 403, 'Tenancy::InsufficientPermissions');
    });

    it('deletes a database and requests teardown', async () => {
        const { user, project } = await seed.orgContext();
        const created = await createDatabase(user.id, project.id, 'doomed');

        const res = await request(ctx.app, databaseRoutes.remove, {
            as: user.id,
            params: { id: created.data().id }
        });

        expect(res.status).toBe(204);
        expect(await Database.findOneBy({ id: created.data().id })).toBeNull();

        await flushEvents();
        expect(provisionEvents.some((event) =>
            event.databaseId === created.data().id && event.action === 'delete' && event.userId === user.id
        )).toBe(true);
    });

    it('forbids delete for a viewer', async () => {
        const { org, project } = await seed.orgContext();
        const viewer = await seed.member(org, OrganizationRole.Viewer);
        const writer = await seed.member(org, OrganizationRole.Admin);
        const created = await createDatabase(writer.id, project.id, 'protected');

        const res = await request(ctx.app, databaseRoutes.remove, {
            as: viewer.id,
            params: { id: created.data().id }
        });

        expectError(res, 403, 'Tenancy::InsufficientPermissions');
    });
});

describe('connection string construction', () => {
    const service = new DatabaseService();

    it('generates credentials like the legacy provisioner', () => {
        const credentials = service.generateCredentials(DatabaseEngine.Mysql);

        expect(credentials.username).toMatch(/^qdb_[0-9a-f]{8}$/);
        expect(credentials.database).toMatch(/^mysql_[0-9a-f]{8}$/);
        expect(credentials.port).toBe(3306);
        expect(credentials.password).toHaveLength(32);
    });

    it('builds engine connection strings from credentials', () => {
        const credentials: DatabaseCredentials = { username: 'user', password: 'pass', database: 'data', port: 1234 };

        expect(service.buildConnectionString(DatabaseEngine.Postgres, credentials, 'host'))
            .toBe('postgresql://user:pass@host:1234/data');
        expect(service.buildConnectionString(DatabaseEngine.Mysql, credentials, 'host'))
            .toBe('mysql://user:pass@host:1234/data');
        expect(service.buildConnectionString(DatabaseEngine.Mariadb, credentials, 'host'))
            .toBe('mysql://user:pass@host:1234/data');
        expect(service.buildConnectionString(DatabaseEngine.Mongodb, credentials, 'host'))
            .toBe('mongodb://user:pass@host:1234/data?authSource=admin');
        expect(service.buildConnectionString(DatabaseEngine.Redis, credentials, 'host'))
            .toBe('redis://:pass@host:1234');
    });
});
