import { afterEach, describe, expect, it, vi } from 'vitest';
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import DeploymentProgress from '@/modules/template/components/DeploymentProgress';
import { latestRun } from '@/modules/template/utils/deployment-run';
import { templateInstallApi } from '@/modules/template/api/api';
import { resetStores } from '@/shared/tests/store-reset';
import { ActivityLevel } from '@quantum/contracts/modules/activity/domain';
import type { Root } from 'react-dom/client';
import type { ActivityEvent } from '@quantum/contracts/modules/activity/domain';

const event = (id: number, level: ActivityLevel, title: string, stepIndex: number, correlationId = '9', message = ''): ActivityEvent => ({
    id, organizationId: 3, userId: 1, scope: 'template', level, title, message, source: 'orchestrator.template', correlationId,
    meta: { templateInstallId: 4, stepIndex, ...(level === ActivityLevel.Success ? { durationMs: 1800 } : {}) },
    ts: `2026-01-01T00:00:${String(10 + id).padStart(2, '0')}.000Z`, createdAt: '2026-01-01T00:00:00.000Z', updatedAt: '2026-01-01T00:00:00.000Z'
});

const EVENTS: ActivityEvent[] = [
    event(6, ActivityLevel.Progress, 'Building api', 1),
    event(5, ActivityLevel.Success, 'Fetching pollium/learn@main', 0),
    event(4, ActivityLevel.Progress, 'Fetching pollium/learn@main', 0),
    event(3, ActivityLevel.Error, 'Install failed', 2, '8', 'Variable DB_URL has no value'),
    event(2, ActivityLevel.Progress, 'Preparing the network', 0, '8')
];

let container: HTMLDivElement | undefined;
let root: Root | undefined;

const settle = async (rounds = 8) => {
    for(let i = 0; i < rounds; i += 1) await act(async () => undefined);
};

afterEach(async () => {
    await act(async () => { root?.unmount(); });
    container?.remove();
    vi.restoreAllMocks();
    resetStores();
});

describe('deployment progress', () => {
    it('keeps only the newest run, one line per step, in order', () => {
        expect(latestRun(EVENTS).map((step) => `${step.level}:${step.title}`)).toEqual([
            'success:Fetching pollium/learn@main', 'progress:Building api'
        ]);
        expect(latestRun([])).toEqual([]);
    });

    it('renders the steps with their outcome and duration', async () => {
        vi.spyOn(templateInstallApi, 'activity').mockResolvedValue(EVENTS);
        container = document.createElement('div');
        document.body.appendChild(container);
        root = createRoot(container);
        await act(async () => { root?.render(<DeploymentProgress installId={4} active={false} />); });
        await settle();

        const text = container.textContent ?? '';
        expect(text).toContain('Fetching pollium/learn@main');
        expect(text).toContain('1.8 s');
        expect(text).toContain('Building api');
        expect(text).not.toContain('Preparing the network');
    });
});
