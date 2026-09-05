import { beforeEach, describe, expect, it } from 'vitest';
import { flushEvents, useApp } from '@tests/harness';
import { seed } from '@tests/Seed';
import { eventBus } from '@/shared/events/EventBus';
import Project from '@/modules/project/models/Project';
import type { ResourceChangedPayload } from '../contracts/types/events';

useApp();

const changes: ResourceChangedPayload[] = [];
eventBus.subscribe('resource.changed', (payload) => { changes.push(payload as ResourceChangedPayload); });

beforeEach(() => {
    changes.length = 0;
});

describe('ResourceChangeSubscriber', () => {
    it('announces an insert with the row\'s organization', async () => {
        const { org } = await seed.orgContext();
        changes.length = 0;

        const project = await Project.create({
            name: 'Realtime',
            slug: 'realtime',
            isDefault: false,
            organizationId: org.id
        }).save();
        await flushEvents();

        expect(changes).toEqual([{ entity: 'Project', action: 'created', organizationId: org.id }]);
        expect(project.id).toBeGreaterThan(0);
    });

    it('announces an update and a remove', async () => {
        const { org, project } = await seed.orgContext();
        changes.length = 0;

        project.name = 'Renamed';
        await project.save();
        await flushEvents();
        expect(changes).toEqual([{ entity: 'Project', action: 'updated', organizationId: org.id }]);

        changes.length = 0;
        await project.remove();
        await flushEvents();
        expect(changes).toEqual([{ entity: 'Project', action: 'removed', organizationId: org.id }]);
    });

    /**
     * There is no room to deliver a tenant-less row to, so it must not be announced —
     * this is what keeps one organization's writes from reaching another's sockets.
     */
    it('stays silent for a row that carries no organization', async () => {
        await seed.user();
        await flushEvents();

        expect(changes).toEqual([]);
    });
});
