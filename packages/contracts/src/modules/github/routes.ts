import { get } from '../../shared/routing';
import type { GithubAccount, GithubOAuthStart, GithubRepository, RepositoryDetection } from './domain';

export const githubRoutes = {
    oauthStart: get<GithubOAuthStart>('/github/oauth/start'),
    oauthCallback: get<void>('/github/oauth/callback'),
    account: get<GithubAccount>('/github/account'),
    repositories: get<GithubRepository[]>('/github/repository'),
    detect: get<RepositoryDetection>('/github/repository/:owner/:repo/detect')
};
