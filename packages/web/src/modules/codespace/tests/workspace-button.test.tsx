import { afterEach, describe, expect, it, vi } from 'vitest';
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import WorkspaceButton from '@/modules/codespace/components/WorkspaceButton';
import { codespaceApi } from '@/modules/codespace/api/api';
import { ApiError } from '@/shared/services/ApiError';
import { CodespaceStatus } from '@quantum/contracts/modules/codespace/domain';
import type { Root } from 'react-dom/client';
import type { Codespace } from '@quantum/contracts/modules/codespace/domain';

const codespace = (status: CodespaceStatus): Codespace => ({
    id: 5, name: 'code-shop', organizationId: 1, projectId: 1, userId: 1, repositoryId: 3, templateInstallId: null,
    imageId: null, networkId: null, containerId: null, portBindingId: null, cpuCores: 1, memoryMb: 2048, diskGb: 10,
    status, accessUrl: 'http://localhost:20010/?folder=/home/coder/project', nodeId: 'local',
    createdAt: '2026-01-01T00:00:00.000Z', updatedAt: '2026-01-01T00:00:00.000Z'
});

let container: HTMLDivElement | undefined;
let root: Root | undefined;

const settle = async (rounds = 8) => {
    for(let i = 0; i < rounds; i += 1) await act(async () => undefined);
};

const render = async () => {
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
    await act(async () => { root?.render(<WorkspaceButton target={{ kind: 'repository', id: 3 }} />); });
    await settle();
};

const button = (): HTMLButtonElement => {
    const found = container?.querySelector('button');
    if(!found) throw new Error('no button rendered');
    return found;
};

afterEach(async () => {
    await act(async () => { root?.unmount(); });
    container?.remove();
    vi.restoreAllMocks();
});

describe('open in vs code', () => {
    it('offers to open a workspace when none exists yet and asks the api to create it', async () => {
        vi.spyOn(codespaceApi, 'forRepository').mockRejectedValue(new ApiError(404, 'Codespace::NotFound'));
        const open = vi.spyOn(codespaceApi, 'openForRepository').mockResolvedValue(codespace(CodespaceStatus.Pending) as never);
        await render();

        expect(button().textContent).toContain('Open in VS Code');

        await act(async () => { button().click(); });
        await settle();

        expect(open).toHaveBeenCalledWith({ path: { repositoryId: 3 } });
    });

    it('shows the access details of a running workspace', async () => {
        vi.spyOn(codespaceApi, 'forRepository').mockResolvedValue(codespace(CodespaceStatus.Running) as never);
        vi.spyOn(codespaceApi, 'access').mockResolvedValue({ accessUrl: 'http://localhost:20010/?folder=/home/coder/project', password: 'secret-pw' } as never);
        await render();

        expect(button().textContent).toContain('VS Code');

        await act(async () => { button().click(); });
        await settle();

        expect(document.body.textContent).toContain('secret-pw');
        expect(document.body.querySelector('a[href="http://localhost:20010/?folder=/home/coder/project"]')).not.toBeNull();
    });
});
