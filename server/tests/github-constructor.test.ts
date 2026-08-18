import { describe, it, expect, vi } from 'vitest';

vi.mock('@octokit/rest', () => ({
    Octokit: class { constructor(public opts: any){} }
}));

vi.mock('@utilities/logger', () => ({ default: { error: vi.fn(), warn: vi.fn(), info: vi.fn() } }));

import Github from '@services/github';

const repo: any = { name: 'hello', owner: 'octocat' };

describe('Github constructor null-safety (no linked GitHub account)', () => {
    it('does not throw when user.github is undefined', () => {
        expect(() => new Github({ _id: 'u1' } as any, repo)).not.toThrow();
    });

    it('does not throw when user is undefined', () => {
        expect(() => new Github(undefined as any, repo)).not.toThrow();
    });

    it('still constructs with a linked github account (auth token used)', () => {
        const user: any = { _id: 'u1', github: { getDecryptedAccessToken: () => 'tok', username: 'octocat' } };
        expect(() => new Github(user, repo)).not.toThrow();
    });
});
