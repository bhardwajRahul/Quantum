import type { BaseEntity } from '../../shared/base';

export interface GithubAccount extends BaseEntity{
    userId: number;
    githubId: string;
    username: string;
    avatarUrl: string | null;
}

export interface GithubOAuthStart{
    url: string;
}

export interface GithubRepository{
    name: string;
    fullName: string;
    owner: string;
    private: boolean;
    defaultBranch: string;
    htmlUrl: string;
    description: string | null;
    branches: string[];
}

export type RepositoryRuntime = 'node' | 'python' | 'go' | 'static';

export interface RepositoryDetection{
    framework: string;
    runtime: RepositoryRuntime;
    installCommand: string;
    buildCommand: string;
    startCommand: string;
    outputDirectory: string;
    port: number;
}
