import { beforeEach, describe, expect, it, vi } from 'vitest';
import ExecBuilder from '@/modules/deployment/orchestrator/build/ExecBuilder';
import ContainerOps from '@/modules/deployment/orchestrator/ContainerOps';
import * as checkout from '@/modules/deployment/orchestrator/build/SourceCheckout';
import type { BuildContext } from '@/modules/deployment/orchestrator/build/BuildContext';

const executeCommand = vi.fn();
const relaunchRepositoryApp = vi.fn();
const start = vi.fn();

beforeEach(() => {
    executeCommand.mockReset().mockResolvedValue({ output: '', exitCode: 0 });
    relaunchRepositoryApp.mockReset().mockResolvedValue(undefined);
    start.mockReset().mockResolvedValue(undefined);
    vi.spyOn(ContainerOps.prototype, 'start').mockImplementation(start as never);
    vi.spyOn(ContainerOps.prototype, 'executeCommand').mockImplementation(executeCommand as never);
    vi.spyOn(ContainerOps.prototype, 'relaunchRepositoryApp').mockImplementation(relaunchRepositoryApp as never);
    vi.spyOn(checkout, 'checkoutRepository').mockResolvedValue({
        commit: 'abc1234def',
        subject: 'Add the thing',
        author: 'Someone',
        date: '2026-09-05T00:00:00.000Z'
    });
});

const context = (overrides: Partial<BuildContext['repository']> = {}): BuildContext => {
    const deployment = { id: 7, repositoryId: 2, commit: null, save: vi.fn().mockResolvedValue(undefined) };

    return {
        repository: {
            id: 2,
            userId: 1,
            url: 'https://github.com/acme/app',
            branch: 'main',
            rootDirectory: '/',
            installCommand: 'npm ci',
            buildCommand: 'npm run build',
            startCommand: 'npm start',
            ...overrides
        },
        deployment,
        container: { id: 1, storagePath: '/var/lib/quantum/x', dockerContainerName: 'c1' },
        nodeId: 'local',
        storagePath: '/var/lib/quantum/x'
    } as unknown as BuildContext;
};

describe('ExecBuilder', () => {
    it('fetches the source, installs, builds and starts the app', async () => {
        const ctx = context();

        await new ExecBuilder().build(ctx);

        expect(checkout.checkoutRepository).toHaveBeenCalledWith('/var/lib/quantum/x', 'https://github.com/acme/app', 'main', 1);
        expect(executeCommand.mock.calls.map(([command]) => command)).toEqual(['npm ci', 'npm run build']);
        expect(executeCommand.mock.calls.every(([, options]) => options.WorkingDir === '/app')).toBe(true);
        expect(relaunchRepositoryApp).toHaveBeenCalledOnce();
    });

    it('makes sure the container is up before running anything in it', async () => {
        await new ExecBuilder().build(context());

        expect(start).toHaveBeenCalledOnce();
        expect(start.mock.invocationCallOrder[0]).toBeLessThan(executeCommand.mock.invocationCallOrder[0]);
    });

    it('records the commit, so the deployment stops reading as a dash', async () => {
        const ctx = context();

        await new ExecBuilder().build(ctx);

        expect(ctx.deployment.commit).toEqual({
            message: 'Add the thing',
            author: { name: 'Someone', email: '' },
            date: '2026-09-05T00:00:00.000Z'
        });
    });

    it('fails the deployment when a build command fails, rather than reporting success', async () => {
        executeCommand.mockResolvedValueOnce({ output: '', exitCode: 0 });
        executeCommand.mockResolvedValueOnce({ output: 'tsc: error', exitCode: 2 });

        await expect(new ExecBuilder().build(context())).rejects.toThrow(
            'The build command failed with exit code 2: npm run build'
        );
        expect(relaunchRepositoryApp).not.toHaveBeenCalled();
    });

    it('runs inside the subdirectory a monorepo declares', async () => {
        await new ExecBuilder().build(context({ rootDirectory: '/packages/web' }));

        expect(executeCommand.mock.calls.every(([, options]) => options.WorkingDir === '/app/packages/web')).toBe(true);
    });

    it('skips a command that was left blank', async () => {
        await new ExecBuilder().build(context({ installCommand: '', buildCommand: 'npm run build' }));

        expect(executeCommand.mock.calls.map(([command]) => command)).toEqual(['npm run build']);
    });
});
