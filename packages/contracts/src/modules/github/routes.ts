import { del, get } from '../../shared/routing';
import type { GithubAccount, GithubRepository, RepositoryDetection } from './domain';

export const githubRoutes = {
    oauthStart: get<void>('/github/oauth/start'),
    oauthCallback: get<void>('/github/oauth/callback'),
    account: get<GithubAccount>('/github/account'),
    remove: del('/github/account'),
    repositories: get<GithubRepository[]>('/github/repository'),
    detect: get<RepositoryDetection>('/github/repository/:owner/:repo/detect')
};
