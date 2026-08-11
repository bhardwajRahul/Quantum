import { GitHub } from 'arctic';
import { config } from '@/shared/config';
import { GithubError } from '../contracts/domain/errors';

const SCOPES = ['user', 'repo'];

export default class GithubOAuthService{
    startUrl(state: string): string{
        return this.#client().createAuthorizationURL(state, SCOPES).toString();
    }

    async exchange(code: string): Promise<string>{
        const client = this.#client();
        try{
            const tokens = await client.validateAuthorizationCode(code);
            return tokens.accessToken();
        }catch{
            throw GithubError.ExchangeFailed();
        }
    }

    #client(): GitHub{
        const { clientId, clientSecret } = config.github;
        if(!clientId || !clientSecret) throw GithubError.NotConfigured();
        return new GitHub(clientId, clientSecret, `${config.oauth.callbackBaseUrl}/github/oauth/callback`);
    }
}
