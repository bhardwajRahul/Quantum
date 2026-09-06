import { describe, expect, it } from 'vitest';
import { useApp, flushEvents } from '@tests/harness';
import { request, expectError } from '@tests/request';
import { seed } from '@tests/Seed';
import { eventBus } from '@/shared/events/EventBus';
import { OrganizationRole } from '@quantum/contracts/modules/organization/domain';
import { TemplateInstallStatus } from '@quantum/contracts/modules/template/domain';
import { templateInstallRoutes } from '@quantum/contracts/modules/template/routes';
import TemplateInstall from '../models/TemplateInstall';
import ActivityEvent from '@/modules/activity/models/ActivityEvent';
import type { TemplateInstalledPayload } from '../contracts/domain/events';

const ctx = useApp();

const COMPOSE = 'services:\n  web:\n    image: nginx:1.27\n';

const createStack = async (userId: number, projectId: number): Promise<number> => {
    const res = await request(ctx.app, templateInstallRoutes.createCompose, {
        as: userId, params: { projectId }, body: { name: 'shop', compose: COMPOSE }
    });
    expect(res.status).toBe(201);
    return res.data().id as number;
};

const tokenOf = (webhookUrl: string): string => new URL(webhookUrl).pathname.split('/').pop() ?? '';

describe('deploy triggers', () => {
    it('gives every stack a webhook url and lets the owner toggle image watching', async () => {
        const { user, project } = await seed.orgContext();
        const id = await createStack(user.id, project.id);

        const initial = await request(ctx.app, templateInstallRoutes.triggers, { as: user.id, params: { id } });
        expect(initial.status).toBe(200);
        expect(initial.data().webhookUrl).toContain(`/template/install/${id}/deploy/`);
        expect(initial.data().watchImages).toBe(false);

        const updated = await request(ctx.app, templateInstallRoutes.updateTriggers, {
            as: user.id, params: { id }, body: { watchImages: true }
        });
        expect(updated.status).toBe(200);
        expect(updated.data().watchImages).toBe(true);
        expect((await TemplateInstall.findOneByOrFail({ id })).watchImages).toBe(true);
    });

    it('redeploys through the webhook with the current token only, and records why', async () => {
        const { user, org, project } = await seed.orgContext();
        const id = await createStack(user.id, project.id);
        await flushEvents();
        const before = (await request(ctx.app, templateInstallRoutes.triggers, { as: user.id, params: { id } })).data().webhookUrl as string;

        const rotated = await request(ctx.app, templateInstallRoutes.rotateDeployToken, { as: user.id, params: { id } });
        expect(rotated.status).toBe(200);
        const current = rotated.data().webhookUrl as string;
        expect(current).not.toBe(before);

        expectError(await request(ctx.app, templateInstallRoutes.deployHook, { params: { id, token: tokenOf(before) } }), 404, 'TemplateInstall::NotFound');
        expectError(await request(ctx.app, templateInstallRoutes.deployHook, { params: { id: 999999, token: tokenOf(current) } }), 404, 'TemplateInstall::NotFound');

        const events: TemplateInstalledPayload[] = [];
        eventBus.subscribe('template.installed', (payload) => { events.push(payload as TemplateInstalledPayload); });

        const hook = await request(ctx.app, templateInstallRoutes.deployHook, { params: { id, token: tokenOf(current) } });
        expect(hook.status).toBe(202);
        expect(hook.data()).toEqual({ queued: true });
        await flushEvents();

        expect(events).toEqual([{ templateInstallId: id, projectId: project.id, templateId: null, userId: user.id }]);
        expect((await TemplateInstall.findOneByOrFail({ id })).status).toBe(TemplateInstallStatus.Pending);
        const activity = await ActivityEvent.findOneBy({ organizationId: org.id, source: 'template.webhook' });
        expect(activity?.title).toContain('shop');
    });

    it('keeps triggers inside the organization and its deployers', async () => {
        const { user, org, project } = await seed.orgContext();
        const id = await createStack(user.id, project.id);
        const viewer = await seed.member(org, OrganizationRole.Viewer);
        const outsider = await seed.orgContext();

        expect((await request(ctx.app, templateInstallRoutes.triggers, { as: viewer.id, params: { id } })).status).toBe(200);
        expectError(await request(ctx.app, templateInstallRoutes.updateTriggers, {
            as: viewer.id, params: { id }, body: { watchImages: true }
        }), 403, 'Tenancy::InsufficientPermissions');
        expectError(await request(ctx.app, templateInstallRoutes.triggers, { as: outsider.user.id, params: { id } }), 404, 'TemplateInstall::NotFound');
    });
});
