import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { renderHook } from '@/shared/tests/render-hook';
import { queryCache } from '@/shared/hooks/api/query-cache';
import { useResourceStream } from '@/shared/hooks/api/use-resource-stream';
import type { MockInstance } from 'vitest';
import type { ResourceChangedFrame } from '@quantum/contracts/modules/resource/gateway';

const handlers: Record<string, (data: unknown) => void> = {};
const sent: string[] = [];

vi.mock('alova', async (importOriginal) => ({
    ...(await importOriginal<typeof import('alova')>()),
    invalidateCache: vi.fn(async () => undefined)
}));

vi.mock('@/shared/hooks/socket/use-channel', () => ({
    useChannel: (_path: string, given: Record<string, (data: unknown) => void>) => {
        Object.assign(handlers, given);
        return {
            send: (type: string) => { sent.push(type); return true; },
            status: 'open' as const,
            lastError: undefined,
            clearError: () => undefined
        };
    }
}));

const emit = (frame: ResourceChangedFrame) => handlers['resource.changed']?.(frame);

const changed = (entity: string): ResourceChangedFrame =>
    ({ entity, action: 'updated', organizationId: 1 });

const flush = async (): Promise<void> => {
    for(let i = 0; i < 8; i += 1) await Promise.resolve();
};

describe('useResourceStream', () => {
    let invalidate: MockInstance<typeof queryCache.invalidateSegment>;

    beforeEach(async () => {
        vi.useFakeTimers();
        sent.length = 0;
        queryCache.reset();
        invalidate = vi.spyOn(queryCache, 'invalidateSegment').mockResolvedValue(undefined);
        await renderHook(() => { useResourceStream(); return null; });
    });

    afterEach(() => {
        invalidate.mockRestore();
        vi.useRealTimers();
    });

    it('subscribes once the socket is open', () => {
        expect(sent).toEqual(['subscribe']);
    });

    /**
     * The reason the window exists: every organization-scoped row is announced, and a
     * running container writes a Metric every few seconds. Without coalescing each of
     * those frames would cost a refetch.
     */
    it('collapses a burst into one refetch per segment', async () => {
        emit(changed('Job'));
        emit(changed('Deployment'));
        emit(changed('DockerContainer'));
        emit(changed('Job'));
        emit(changed('Project'));

        expect(invalidate).not.toHaveBeenCalled();

        await vi.advanceTimersByTimeAsync(1_000);
        await flush();

        const segments = invalidate.mock.calls.map(([segment]) => segment).sort();
        expect(segments).toEqual(['deployment', 'docker', 'project']);
    });

    it('drops a frame for an entity it cannot place, rather than guessing a segment', async () => {
        emit(changed('SomethingUnmapped'));

        await vi.advanceTimersByTimeAsync(2_000);
        await flush();

        expect(invalidate).not.toHaveBeenCalled();
    });

    it('opens a new window for changes that arrive after a flush', async () => {
        emit(changed('Domain'));
        await vi.advanceTimersByTimeAsync(1_000);
        await flush();
        expect(invalidate.mock.calls.map(([segment]) => segment)).toEqual(['domain']);

        emit(changed('Domain'));
        await vi.advanceTimersByTimeAsync(1_000);
        await flush();
        expect(invalidate.mock.calls.map(([segment]) => segment)).toEqual(['domain', 'domain']);
    });
});
