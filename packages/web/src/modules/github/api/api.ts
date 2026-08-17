import { call } from '@/shared/api/call';
import { githubRoutes } from '@quantum/contracts/modules/github/routes';

export const githubApi = {
    account: () => call(githubRoutes.account),
    remove: () => call(githubRoutes.remove),
    repositories: () => call(githubRoutes.repositories),
    detect: (owner: string, repo: string) => call(githubRoutes.detect, { path: { owner, repo } })
};
