import { mkdtemp, mkdir, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { dotenvPath, importDotenv } from '@/modules/deployment/orchestrator/build/dotenvImport';
import type Deployment from '@/modules/deployment/models/Deployment';

const dirs: string[] = [];

const checkout = async (files: Record<string, string>): Promise<string> => {
    const dir = await mkdtemp(path.join(tmpdir(), 'quantum-dotenv-'));
    dirs.push(dir);
    for(const [name, content] of Object.entries(files)){
        await mkdir(path.dirname(path.join(dir, name)), { recursive: true });
        await writeFile(path.join(dir, name), content);
    }
    return dir;
};

const deploymentWith = (environmentVariables: Record<string, string>) => {
    const save = vi.fn().mockResolvedValue(undefined);
    return { deployment: { environmentVariables, save } as unknown as Deployment, save };
};

afterEach(async () => {
    await Promise.all(dirs.splice(0).map((dir) => rm(dir, { recursive: true, force: true })));
});

describe('dotenv import', () => {
    it('adds the variables of the checkout .env that the user has not set, keeping theirs', async () => {
        const dir = await checkout({ '.env': '# comment\nPORT=3000\nDATABASE_URL="postgres://db/app"\nexport DEBUG=true\n' });
        const { deployment, save } = deploymentWith({ PORT: '8080' });

        const added = await importDotenv(deployment, dir, '/');

        expect(added).toEqual(['DATABASE_URL', 'DEBUG']);
        expect(deployment.environmentVariables).toEqual({ PORT: '8080', DATABASE_URL: 'postgres://db/app', DEBUG: 'true' });
        expect(save).toHaveBeenCalledTimes(1);
    });

    it('reads the .env from the configured root directory', async () => {
        const dir = await checkout({ 'apps/api/.env': 'API_KEY=k\n', '.env': 'WRONG=1\n' });
        const { deployment } = deploymentWith({});

        expect(dotenvPath(dir, '/apps/api')).toBe(path.join(dir, 'apps/api/.env'));
        expect(await importDotenv(deployment, dir, '/apps/api')).toEqual(['API_KEY']);
        expect(deployment.environmentVariables).toEqual({ API_KEY: 'k' });
    });

    it('does nothing when there is no .env or nothing new in it', async () => {
        const { deployment, save } = deploymentWith({ PORT: '1' });

        expect(await importDotenv(deployment, await checkout({}), '/')).toEqual([]);
        expect(await importDotenv(deployment, await checkout({ '.env': 'PORT=3000\n' }), '/')).toEqual([]);
        expect(deployment.environmentVariables).toEqual({ PORT: '1' });
        expect(save).not.toHaveBeenCalled();
    });
});
