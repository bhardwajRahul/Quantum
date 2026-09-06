import { execFile } from 'node:child_process';
import { chmod, mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { promisify } from 'node:util';
import path from 'node:path';
import SecretCipher from '@/shared/services/SecretCipher';
import GithubAccount from '@/modules/github/models/GithubAccount';
import { logger } from '@/shared/utils/Logger';

const run = promisify(execFile);

export interface CheckoutResult{
    commit: string;
    subject: string;
    author: string;
    date: string;
}

/**
 * The token is handed to git through an askpass script rather than embedded in the
 * remote URL. A URL with credentials in it gets written into `.git/config`, where it
 * outlives the deployment; passing it as an argument would instead expose it in
 * `/proc/<pid>/cmdline` to anything else on the host. The script is 0700, lives in a
 * private temp dir, and is deleted whatever happens.
 */
const withCredentials = async <T>(token: string | null, body: (env: NodeJS.ProcessEnv) => Promise<T>): Promise<T> => {
    if(token === null) return body({});

    const dir = await mkdtemp(path.join(tmpdir(), 'quantum-git-'));
    const askpass = path.join(dir, 'askpass.sh');
    try{
        await writeFile(askpass, `#!/bin/sh\ncase "$1" in Username*) echo x-access-token ;; *) echo "$QUANTUM_GIT_TOKEN" ;; esac\n`);
        await chmod(askpass, 0o700);
        return await body({ GIT_ASKPASS: askpass, QUANTUM_GIT_TOKEN: token, GIT_TERMINAL_PROMPT: '0' });
    }finally{
        await rm(dir, { recursive: true, force: true });
    }
};

const tokenFor = async (userId: number): Promise<string | null> => {
    const account = await GithubAccount.findOneBy({ userId });
    if(account === null) return null;

    try{
        return new SecretCipher().decrypt(account.accessToken);
    }catch{
        logger.warn(`could not decrypt the GitHub token for user ${userId} — cloning as an anonymous client`,
            { scope: 'orchestrator.build' });
        return null;
    }
};

const git = (cwd: string, env: NodeJS.ProcessEnv, ...args: string[]): Promise<{ stdout: string }> =>
    run('git', args, { cwd, env: { ...process.env, ...env }, maxBuffer: 16 * 1024 * 1024 });

/**
 * Puts the repository's code where the container will find it. `storagePath` is bind
 * mounted at `/app`, so writing here from the API is what makes the source visible
 * inside — and it is the API, not the runtime image, that has git: the runtime images
 * are plain `node:*-alpine`, `python:*-alpine` and friends.
 */
export const checkoutRepository = async (
    storagePath: string,
    url: string,
    branch: string,
    userId: number
): Promise<CheckoutResult> => {
    await mkdir(storagePath, { recursive: true });
    const token = await tokenFor(userId);

    return withCredentials(token, async (env) => {
        // Idempotent by design: the second deployment of a repository fetches into the
        // checkout the first one left, instead of re-cloning it.
        await git(storagePath, env, 'init', '--quiet');
        await git(storagePath, env, 'remote', 'remove', 'origin').catch(() => undefined);
        await git(storagePath, env, 'remote', 'add', 'origin', url);
        await git(storagePath, env, 'fetch', '--depth', '1', 'origin', branch);
        await git(storagePath, env, 'checkout', '--force', 'FETCH_HEAD');

        const { stdout } = await git(storagePath, env, 'log', '-1', '--pretty=%H%x1f%s%x1f%an%x1f%aI', 'FETCH_HEAD');
        const [commit, subject, author, date] = stdout.trim().split('\x1f');

        return {
            commit: commit ?? '',
            subject: subject ?? '',
            author: author ?? '',
            date: date ?? new Date().toISOString()
        };
    });
};
