import GithubAccountService from './GithubAccountService';
import { detectPreset } from './detectPreset';
import type { Octokit } from '@octokit/rest';
import type { GithubRepository, RepositoryDetection } from '@quantum/contracts/modules/github/domain';
import type { PackageJson } from './detectPreset';

const PER_PAGE = 100;

interface GithubApiRepository{
    name: string;
    full_name: string;
    private: boolean;
    default_branch: string;
    html_url: string;
    description: string | null;
    owner: { login: string };
}

export default class GithubRepositoryService{
    #accounts = new GithubAccountService();

    async listMyRepositories(userId: number): Promise<GithubRepository[]>{
        const octokit = this.#accounts.createClient(await this.#accounts.requireForUser(userId));
        const repositories = await octokit.paginate(octokit.rest.repos.listForAuthenticatedUser, {
            visibility: 'all',
            per_page: PER_PAGE
        });
        return Promise.all(repositories.map((repository) => this.#toRepository(octokit, repository)));
    }

    async detect(userId: number, owner: string, repo: string): Promise<RepositoryDetection>{
        const octokit = this.#accounts.createClient(await this.#accounts.requireForUser(userId));
        const files = await this.#rootFileNames(octokit, owner, repo);
        const packageJson = await this.#readPackageJson(octokit, owner, repo);
        return detectPreset(files, packageJson);
    }

    async #toRepository(octokit: Octokit, repository: GithubApiRepository): Promise<GithubRepository>{
        return {
            name: repository.name,
            fullName: repository.full_name,
            owner: repository.owner.login,
            private: repository.private,
            defaultBranch: repository.default_branch,
            htmlUrl: repository.html_url,
            description: repository.description,
            branches: await this.#branchNames(octokit, repository.owner.login, repository.name)
        };
    }

    async #branchNames(octokit: Octokit, owner: string, repo: string): Promise<string[]>{
        const branches = await octokit.paginate(octokit.rest.repos.listBranches, {
            owner,
            repo,
            per_page: PER_PAGE
        });
        return branches.map((branch) => branch.name);
    }

    async #rootFileNames(octokit: Octokit, owner: string, repo: string): Promise<string[]>{
        const { data } = await octokit.rest.repos.getContent({ owner, repo, path: '' });
        return Array.isArray(data) ? data.map((file) => file.name) : [];
    }

    async #readPackageJson(octokit: Octokit, owner: string, repo: string): Promise<PackageJson | null>{
        try{
            const { data } = await octokit.rest.repos.getContent({ owner, repo, path: 'package.json' });
            if(Array.isArray(data) || data.type !== 'file') return null;
            return JSON.parse(Buffer.from(data.content, 'base64').toString('utf8')) as PackageJson;
        }catch{
            return null;
        }
    }
}
