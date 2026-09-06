import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useApp, flushEvents } from '@tests/harness';
import { seed } from '@tests/Seed';
import { eventBus } from '@/shared/events/EventBus';
import { TemplateInstallStatus } from '@quantum/contracts/modules/template/domain';
import TemplateInstall from '@/modules/template/models/TemplateInstall';
import ActivityEvent from '@/modules/activity/models/ActivityEvent';
import ImageWatchHandler from '../orchestrator/handlers/ImageWatchHandler';
import type { TemplateInstalledPayload } from '@/modules/template/contracts/domain/events';

const registry = vi.hoisted(() => ({ local: new Map<string, string>(), remote: new Map<string, string>(), pulls: [] as string[] }));

vi.mock('@/modules/deployment/orchestrator/DockerHost', () => ({
    getDockerHost: () => ({
        client: () => ({
            getImage: (ref: string) => ({
                inspect: async () => {
                    const id = registry.local.get(ref);
                    if(id === undefined) throw new Error('no such image');
                    return { Id: id };
                }
            })
        })
    })
}));

vi.mock('@/modules/deployment/orchestrator/pullImage', () => ({
    pullImage: async (_docker: unknown, ref: string) => {
        registry.pulls.push(ref);
        const remote = registry.remote.get(ref);
        if(remote !== undefined) registry.local.set(ref, remote);
    }
}));

useApp();

const IMAGE = 'ghcr.io/acme/api:main';

const seedStack = async (watchImages: boolean, status = TemplateInstallStatus.Running): Promise<TemplateInstall> => {
    const { user, org, project } = await seed.orgContext();
    return TemplateInstall.create({
        name: 'shop', organizationId: org.id, projectId: project.id, userId: user.id, status, watchImages,
        services: [{ name: 'api', kind: 'app', image: IMAGE, containerId: 1, ports: [], address: null }]
    }).save();
};

describe('image watch', () => {
    beforeEach(() => {
        registry.local.clear();
        registry.remote.clear();
        registry.pulls.length = 0;
    });

    it('redeploys a watched stack when a pulled tag points at a new image', async () => {
        const stack = await seedStack(true);
        registry.local.set(IMAGE, 'sha256:old');
        registry.remote.set(IMAGE, 'sha256:new');
        const events: TemplateInstalledPayload[] = [];
        eventBus.subscribe('template.installed', (payload) => { events.push(payload as TemplateInstalledPayload); });

        await new ImageWatchHandler().run('local');
        await flushEvents();

        expect(registry.pulls).toEqual([IMAGE]);
        expect(events.map((event) => event.templateInstallId)).toEqual([stack.id]);
        expect((await TemplateInstall.findOneByOrFail({ id: stack.id })).status).toBe(TemplateInstallStatus.Pending);
        const activity = await ActivityEvent.findOneBy({ organizationId: stack.organizationId ?? 0, source: 'orchestrator.image-watch' });
        expect(activity?.title).toBe('shop: new image for api');
    });

    it('leaves a stack alone when the tag still points at the same image, and skips unwatched stacks', async () => {
        const watched = await seedStack(true);
        await seedStack(false);
        registry.local.set(IMAGE, 'sha256:same');
        const events: TemplateInstalledPayload[] = [];
        eventBus.subscribe('template.installed', (payload) => { events.push(payload as TemplateInstalledPayload); });

        await new ImageWatchHandler().run('local');
        await flushEvents();

        expect(registry.pulls).toEqual([IMAGE]);
        expect(events).toEqual([]);
        expect((await TemplateInstall.findOneByOrFail({ id: watched.id })).status).toBe(TemplateInstallStatus.Running);
    });
});
