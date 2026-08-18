import { describe, it, expect, vi, beforeEach } from 'vitest';
import mongoose from 'mongoose';

const { createAndStartContainer, start, listContainers, find } = vi.hoisted(() => ({
    createAndStartContainer: vi.fn().mockResolvedValue(undefined),
    start: vi.fn().mockResolvedValue(undefined),
    listContainers: vi.fn(),
    find: vi.fn()
}));

vi.mock('@services/docker/host', () => ({
    getDockerHost: () => ({ nodeId: 'local', listContainers }),
    default: () => ({ nodeId: 'local', listContainers })
}));

vi.mock('@services/docker/container', () => ({
    default: class {
        createAndStartContainer = createAndStartContainer;
        start = start;
    }
}));

vi.mock('@models/docker/container', () => ({
    default: { find }
}));

import { runReconcile } from '@services/orchestrator/handlers/reconcileHandler';

const makeContainer = (over: any = {}) => ({
    _id: new mongoose.Types.ObjectId(),
    dockerContainerName: over.dockerContainerName || 'quantum-container-test-x',
    desiredState: over.desiredState || 'running',
    repository: over.repository,
    ...over
});

const fakeJob = () => ({ _id: new mongoose.Types.ObjectId(), nodeId: 'local' } as any);

describe('runReconcile', () => {
    beforeEach(() => {
        createAndStartContainer.mockClear();
        start.mockClear();
        listContainers.mockReset();
        find.mockReset();
    });

    it('recreates a container that is missing from the daemon (self-heal)', async () => {
        find.mockResolvedValue([makeContainer({ dockerContainerName: 'missing-one' })]);
        listContainers.mockResolvedValue([]);
        await runReconcile(fakeJob());
        expect(createAndStartContainer).toHaveBeenCalledTimes(1);
        expect(start).not.toHaveBeenCalled();
    });

    it('starts a container that exists but may not be running', async () => {
        find.mockResolvedValue([makeContainer({ dockerContainerName: 'present-one' })]);
        listContainers.mockResolvedValue([{ Names: ['/present-one'] }]);
        await runReconcile(fakeJob());
        expect(start).toHaveBeenCalledTimes(1);
        expect(createAndStartContainer).not.toHaveBeenCalled();
    });

    it('never force-starts a container the user deliberately stopped', async () => {
        find.mockResolvedValue([makeContainer({ dockerContainerName: 'stopped-one', desiredState: 'stopped' })]);
        listContainers.mockResolvedValue([]);
        await runReconcile(fakeJob());
        expect(start).not.toHaveBeenCalled();
        expect(createAndStartContainer).not.toHaveBeenCalled();
    });

    it('handles a mixed fleet correctly', async () => {
        find.mockResolvedValue([
            makeContainer({ dockerContainerName: 'a-missing' }),
            makeContainer({ dockerContainerName: 'b-present' }),
            makeContainer({ dockerContainerName: 'c-stopped', desiredState: 'stopped' })
        ]);
        listContainers.mockResolvedValue([{ Names: ['/b-present'] }]);
        await runReconcile(fakeJob());
        expect(createAndStartContainer).toHaveBeenCalledTimes(1);
        expect(start).toHaveBeenCalledTimes(1);

    });
});
