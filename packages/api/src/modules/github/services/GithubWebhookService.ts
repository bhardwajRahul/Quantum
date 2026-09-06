import GithubAccountService from './GithubAccountService';

const EVENTS = ['push', 'release'];

export default class GithubWebhookService{
    #accounts = new GithubAccountService();

    async register(userId: number, owner: string, repo: string, url: string, secret: string): Promise<string>{
        const octokit = this.#accounts.createClient(await this.#accounts.requireForUser(userId));
        const { data } = await octokit.rest.repos.createWebhook({
            owner,
            repo,
            events: EVENTS,
            active: true,
            config: { url, content_type: 'json', secret }
        });
        return String(data.id);
    }

    async remove(userId: number, owner: string, repo: string, hookId: string): Promise<void>{
        const octokit = this.#accounts.createClient(await this.#accounts.requireForUser(userId));
        try{
            await octokit.rest.repos.deleteWebhook({ owner, repo, hook_id: Number(hookId) });
        }catch(error){
            if((error as { status?: number }).status !== 404) throw error;
        }
    }
}
