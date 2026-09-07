import { createHmac } from 'node:crypto';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { useApp, flushEvents } from '@tests/harness';
import { request, expectError } from '@tests/request';
import { seed } from '@tests/Seed';
import { eventBus } from '@/shared/events/EventBus';
import SecretCipher from '@/shared/services/SecretCipher';
import { OrganizationRole } from '@quantum/contracts/modules/organization/domain';
import { TemplateInstallStatus } from '@quantum/contracts/modules/template/domain';
import { templateInstallRoutes } from '@quantum/contracts/modules/template/routes';
import GithubAccount from '@/modules/github/models/GithubAccount';
import GithubAccountService from '@/modules/github/services/GithubAccountService';
import ActivityEvent from '@/modules/activity/models/ActivityEvent';
import ActivityStepContext from '@/modules/activity/services/ActivityStepContext';
import TemplateInstall from '../models/TemplateInstall';
import type { TemplateInstalledPayload } from '../contracts/domain/events';

const ctx = useApp();

const COMPOSE = 'services:\n  api:\n    build: ./api\n    environment:\n      DATABASE_URL: ${DATABASE_URL}\n  db:\n    image: postgres:${PG_VERSION:-18}\n';

const files: Record<string, string> = { 'docker-compose.yml': COMPOSE, 'compose.dokploy.yml': 'services:\n  web:\n    image: nginx\n' };
const deleteWebhook = vi.fn(async () => undefined);
const createWebhook = vi.fn(async () => ({ data: { id: 77 } }));

const fakeOctokit = {
    rest: {
        repos: {
            getContent: async ({ path }: { path: string }) => {
                if(path === '') return { data: [...Object.keys(files), 'README.md'].map((name) => ({ name })) };
                if(!(path in files)) throw Object.assign(new Error('Not Found'), { status: 404 });
                return { data: { type: 'file', content: Buffer.from(files[path]).toString('base64') } };
            },
            createWebhook,
            deleteWebhook
        }
    }
};

const connectGithub = async (userId: number) => {
    await GithubAccount.create({
        userId, githubId: String(userId), username: 'octocat', accessToken: new SecretCipher().encrypt('gh-token')
    }).save();
    vi.spyOn(GithubAccountService.prototype, 'createClient').mockReturnValue(fakeOctokit as never);
};

const createStack = async (userId: number, projectId: number, deployOn: 'push' | 'release' = 'push') => {
    const res = await request(ctx.app, templateInstallRoutes.createFromSource, {
        as: userId, params: { projectId },
        body: { name: 'learn', owner: 'pollium', repo: 'learn', branch: 'main', composePath: 'docker-compose.yml', deployOn, variables: { DATABASE_URL: 'postgres://db/learn' } }
    });
    expect(res.status).toBe(201);
    return res.data();
};

const sign = (secret: string, raw: string): string => 'sha256=' + createHmac('sha256', secret).update(raw).digest('hex');

const hook = async (id: number, event: string, raw: string, signature?: string) => ctx.app.inject({
    method: 'POST',
    url: `/template/install/${id}/github`,
    headers: { 'content-type': 'application/json', 'x-github-event': event, ...(signature === undefined ? {} : { 'x-hub-signature-256': signature }) },
    payload: raw
});

const secretOf = async (id: number): Promise<string> => new SecretCipher().decrypt((await TemplateInstall.findOneByOrFail({ id })).webhookSecretEnc ?? '');

afterEach(() => {
    vi.restoreAllMocks();
    createWebhook.mockClear();
    deleteWebhook.mockClear();
});

describe('stacks from a repository', () => {
    it('inspects a repository: compose files, the variables of the chosen one and whether it parses', async () => {
        const { user } = await seed.orgContext();
        await connectGithub(user.id);

        const res = await request(ctx.app, templateInstallRoutes.inspectSource, {
            as: user.id, body: { owner: 'pollium', repo: 'learn', branch: 'main' }
        });

        expect(res.status).toBe(200);
        expect(res.data()).toEqual({
            composeFiles: ['docker-compose.yml', 'compose.dokploy.yml'],
            composePath: 'docker-compose.yml',
            variables: [{ name: 'DATABASE_URL', required: true }, { name: 'PG_VERSION', required: false }],
            problem: null
        });
    });

    it('creates the stack from the repository, registers the webhook and starts provisioning', async () => {
        const { user, project } = await seed.orgContext();
        await connectGithub(user.id);
        const events: TemplateInstalledPayload[] = [];
        eventBus.subscribe('template.installed', (payload) => { events.push(payload as TemplateInstalledPayload); });

        const created = await createStack(user.id, project.id);
        await flushEvents();

        expect(created.source).toEqual({ owner: 'pollium', repo: 'learn', branch: 'main', composePath: 'docker-compose.yml', deployOn: 'push' });
        expect(created.compose).toBe(COMPOSE);
        expect(events.map((event) => event.templateInstallId)).toEqual([created.id]);
        expect(createWebhook).toHaveBeenCalledWith(expect.objectContaining({
            owner: 'pollium', repo: 'learn', events: ['push', 'release'],
            config: expect.objectContaining({ url: expect.stringContaining(`/template/install/${created.id}/github`) })
        }));
        const stored = await TemplateInstall.findOneByOrFail({ id: created.id });
        expect(stored.webhookId).toBe('77');
        expect(stored.spec?.services.api.build).toEqual({ context: './api' });

        const variables = await request(ctx.app, templateInstallRoutes.variables, { as: user.id, params: { id: created.id } });
        expect(variables.data()).toEqual({ DATABASE_URL: 'postgres://db/learn' });
    });

    it('refuses a compose file the repository does not have', async () => {
        const { user, project } = await seed.orgContext();
        await connectGithub(user.id);

        const res = await request(ctx.app, templateInstallRoutes.createFromSource, {
            as: user.id, params: { projectId: project.id },
            body: { name: 'learn', owner: 'pollium', repo: 'learn', branch: 'main', composePath: 'missing.yml', deployOn: 'push' }
        });

        expectError(res, 400, 'TemplateInstall::ComposeFileNotFound:missing.yml');
    });

    it('redeploys on a signed push to the tracked branch and ignores the rest', async () => {
        const { user, org, project } = await seed.orgContext();
        await connectGithub(user.id);
        const created = await createStack(user.id, project.id);
        await flushEvents();
        const secret = await secretOf(created.id);
        const events: TemplateInstalledPayload[] = [];
        eventBus.subscribe('template.installed', (payload) => { events.push(payload as TemplateInstalledPayload); });

        const ping = await hook(created.id, 'ping', '{"zen":"hi"}', sign(secret, '{"zen":"hi"}'));
        expect(ping.statusCode).toBe(200);

        const other = JSON.stringify({ ref: 'refs/heads/dev', pusher: { name: 'rody' } });
        expect((await hook(created.id, 'push', other, sign(secret, other))).json()).toEqual({ data: { skipped: true, reason: 'branch-mismatch' } });

        const release = JSON.stringify({ action: 'published', release: { tag_name: 'v1' } });
        expect((await hook(created.id, 'release', release, sign(secret, release))).json()).toEqual({ data: { ok: true } });

        const main = JSON.stringify({ ref: 'refs/heads/main', pusher: { name: 'rody' }, head_commit: { message: 'ship it\n\nbody' } });
        const forged = await hook(created.id, 'push', main, sign('wrong', main));
        expect(forged.statusCode).toBe(401);
        expect((await hook(created.id, 'push', main)).statusCode).toBe(401);

        const accepted = await hook(created.id, 'push', main, sign(secret, main));
        expect(accepted.statusCode).toBe(202);
        await flushEvents();

        expect(events.map((event) => event.templateInstallId)).toEqual([created.id]);
        expect((await TemplateInstall.findOneByOrFail({ id: created.id })).status).toBe(TemplateInstallStatus.Pending);
        const activity = await ActivityEvent.findOneBy({ organizationId: org.id, source: 'github' });
        expect(activity?.title).toBe('learn: push to main by rody');
        expect(activity?.message).toBe('ship it');
    });

    it('redeploys on published releases when the stack asks for that', async () => {
        const { user, project } = await seed.orgContext();
        await connectGithub(user.id);
        const created = await createStack(user.id, project.id, 'release');
        await flushEvents();
        const secret = await secretOf(created.id);

        const push = JSON.stringify({ ref: 'refs/heads/main' });
        expect((await hook(created.id, 'push', push, sign(secret, push))).json()).toEqual({ data: { ok: true } });

        const draft = JSON.stringify({ action: 'created', release: { tag_name: 'v2' } });
        expect((await hook(created.id, 'release', draft, sign(secret, draft))).json()).toEqual({ data: { skipped: true, reason: 'not-published' } });

        const published = JSON.stringify({ action: 'published', release: { tag_name: 'v2', name: 'Two' } });
        expect((await hook(created.id, 'release', published, sign(secret, published))).statusCode).toBe(202);
    });

    it('lists the deployment steps of a stack, newest first, and keeps them inside the organization', async () => {
        const { user, org, project } = await seed.orgContext();
        await connectGithub(user.id);
        const created = await createStack(user.id, project.id);
        const steps = new ActivityStepContext({
            organizationId: org.id, userId: user.id, scope: 'template', source: 'orchestrator.template', correlationId: '9', meta: { templateInstallId: created.id }
        });
        await steps.step('Fetching pollium/learn@main', async () => undefined);
        await steps.step('Building api', async () => { throw new Error('docker build failed'); }).catch(() => undefined);

        const res = await request(ctx.app, templateInstallRoutes.activity, { as: user.id, params: { id: created.id } });
        expect(res.status).toBe(200);
        const titles = res.data().map((event) => `${event.level}:${event.title}`);
        expect(titles.slice(0, 4)).toEqual([
            'error:Building api', 'progress:Building api', 'success:Fetching pollium/learn@main', 'progress:Fetching pollium/learn@main'
        ]);
        expect(res.data()[0].message).toBe('docker build failed');
        expect(res.data().every((event) => event.meta.templateInstallId === created.id)).toBe(true);

        const outsider = await seed.orgContext();
        expectError(await request(ctx.app, templateInstallRoutes.activity, { as: outsider.user.id, params: { id: created.id } }), 404, 'TemplateInstall::NotFound');
    });

    it('lets deployers change the source and variables, keeps viewers out, and drops the webhook with the stack', async () => {
        const { user, org, project } = await seed.orgContext();
        await connectGithub(user.id);
        const created = await createStack(user.id, project.id);
        const viewer = await seed.member(org, OrganizationRole.Viewer);

        expectError(await request(ctx.app, templateInstallRoutes.updateSource, {
            as: viewer.id, params: { id: created.id }, body: { branch: 'dev', composePath: 'docker-compose.yml', deployOn: 'release' }
        }), 403, 'Tenancy::InsufficientPermissions');

        const updated = await request(ctx.app, templateInstallRoutes.updateSource, {
            as: user.id, params: { id: created.id }, body: { branch: 'dev', composePath: 'compose.dokploy.yml', deployOn: 'release' }
        });
        expect(updated.status).toBe(200);
        expect(updated.data().source).toEqual({ owner: 'pollium', repo: 'learn', branch: 'dev', composePath: 'compose.dokploy.yml', deployOn: 'release' });

        const variables = await request(ctx.app, templateInstallRoutes.updateVariables, {
            as: user.id, params: { id: created.id }, body: { variables: { DATABASE_URL: 'postgres://db2/learn', PG_VERSION: '17' } }
        });
        expect(variables.status).toBe(200);
        expect((await request(ctx.app, templateInstallRoutes.variables, { as: user.id, params: { id: created.id } })).data())
            .toEqual({ DATABASE_URL: 'postgres://db2/learn', PG_VERSION: '17' });

        const removed = await request(ctx.app, templateInstallRoutes.remove, { as: user.id, params: { id: created.id } });
        expect(removed.status).toBe(204);
        expect(deleteWebhook).toHaveBeenCalledWith({ owner: 'pollium', repo: 'learn', hook_id: 77 });
    });
});
