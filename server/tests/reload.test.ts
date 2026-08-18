import { describe, it, expect, vi, beforeEach } from 'vitest';
import mongoose from 'mongoose';

const { findById, reloadContainer } = vi.hoisted(() => ({
    findById: vi.fn(),
    reloadContainer: vi.fn().mockResolvedValue(undefined)
}));

vi.mock('@models/docker/container', () => ({
    default: { findById }
}));

vi.mock('@services/docker/container', () => ({
    default: class {
        container: any;
        constructor(container: any){ this.container = container; }
        reloadContainer = reloadContainer;
    }
}));

import { runReload } from '@services/orchestrator/handlers/reloadHandler';

const job = (containerId?: any) => ({
    _id: new mongoose.Types.ObjectId(),
    target: containerId ? { container: containerId } : {}
} as any);

describe('runReload (ADR-0001 durable reload job)', () => {
    beforeEach(() => {
        findById.mockReset();
        reloadContainer.mockClear();
    });

    it('loads the target container and reloads it once', async () => {
        const containerId = new mongoose.Types.ObjectId();
        findById.mockResolvedValue({ _id: containerId, dockerContainerName: 'q-x' });
        await runReload(job(containerId));
        expect(findById).toHaveBeenCalledWith(containerId.toString());
        expect(reloadContainer).toHaveBeenCalledTimes(1);
    });

    it('throws when the job has no target container', async () => {
        await expect(runReload(job())).rejects.toThrow('Reload::Container::Required');
        expect(reloadContainer).not.toHaveBeenCalled();
    });

    it('no-ops (no throw) when the container doc was deleted before the job ran', async () => {
        findById.mockResolvedValue(null);
        await expect(runReload(job(new mongoose.Types.ObjectId()))).resolves.toBeUndefined();
        expect(reloadContainer).not.toHaveBeenCalled();
    });
});
