import { Octokit } from '@octokit/rest';
import { config } from '@/shared/config';
import { eventBus } from '@/shared/events/EventBus';
import SecretCipher from '@/shared/services/SecretCipher';
import { GithubError } from '../contracts/domain/errors';
import GithubAccount from '../models/GithubAccount';
import type { GithubUserProfile } from '../contracts/domain/github';
import type { GithubAccount as GithubAccountPayload } from '@quantum/contracts/modules/github/domain';

export default class GithubAccountService{
    #cipher = new SecretCipher();

    async upsertFromGithub(userId: number, profile: GithubUserProfile, accessToken: string): Promise<GithubAccount>{
        const values = {
            githubId: String(profile.id),
            username: profile.login,
            avatarUrl: profile.avatar_url,
            accessToken: this.#cipher.encrypt(accessToken)
        };

        const existing = await GithubAccount.findOneBy({ userId });
        const account = existing === null
            ? await GithubAccount.create({ userId, ...values }).save()
            : await Object.assign(existing, values).save();

        eventBus.emit('github.connected', { userId, username: account.username });
        return account;
    }

    async present(account: GithubAccount): Promise<GithubAccountPayload>{
        const clientId = config.github.clientId;
        return {
            ...(account.toJSON() as object),
            organizationAccessUrl: clientId ? `https://github.com/settings/connections/applications/${clientId}` : null,
            scopes: await this.scopesOf(account)
        } as GithubAccountPayload;
    }

    async scopesOf(account: GithubAccount): Promise<string[]>{
        try{
            const { headers } = await this.createClient(account).request('GET /user');
            return String(headers['x-oauth-scopes'] ?? '').split(',').map((scope) => scope.trim()).filter((scope) => scope !== '');
        }catch{
            return [];
        }
    }

    getForUser(userId: number): Promise<GithubAccount | null>{
        return GithubAccount.findOneBy({ userId });
    }

    async requireForUser(userId: number): Promise<GithubAccount>{
        const account = await this.getForUser(userId);
        if(account === null) throw GithubError.NotConnected();
        return account;
    }

    async removeForUser(userId: number): Promise<void>{
        const account = await this.getForUser(userId);
        if(account === null) throw GithubError.AccountNotFound();
        await account.remove();
        eventBus.emit('github.disconnected', { userId });
    }

    createClient(account: GithubAccount): Octokit{
        return new Octokit({ auth: this.#cipher.decrypt(account.accessToken) });
    }

    async fetchProfile(accessToken: string): Promise<GithubUserProfile>{
        try{
            const { data } = await new Octokit({ auth: accessToken }).rest.users.getAuthenticated();
            return { id: data.id, login: data.login, avatar_url: data.avatar_url, name: data.name ?? null };
        }catch{
            throw GithubError.ExchangeFailed();
        }
    }
}
