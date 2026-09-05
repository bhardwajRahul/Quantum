import BaseController from '@/shared/controllers/BaseController';
import RedirectResponse from '@/shared/controllers/RedirectResponse';
import { Route } from '@/shared/controllers/Route';
import { Param, Query } from '@/shared/controllers/RequestParams';
import { Middleware } from '@/shared/middlewares/Middleware';
import { config } from '@/shared/config';
import { AuthenticatedRoute } from '@/modules/auth/middlewares/AuthenticatedRoute';
import { CurrentUser } from '@/modules/auth/middlewares/CurrentUser';
import GithubAccountService from '../services/GithubAccountService';
import GithubOAuthService from '../services/GithubOAuthService';
import GithubRepositoryService from '../services/GithubRepositoryService';
import OAuthStateService from '../services/OAuthStateService';
import { GithubError } from '../contracts/domain/errors';
import { githubRoutes } from '@quantum/contracts/modules/github/routes';
import type { GithubOAuthCallbackQuery } from '@quantum/contracts/modules/github/http';

export default class GithubController extends BaseController{
    #oauth = new GithubOAuthService();
    #state = new OAuthStateService();
    #accounts = new GithubAccountService();
    #repositories = new GithubRepositoryService();

    /**
     * Answers with the authorize URL rather than redirecting to it. The route is
     * Bearer-authenticated, so the browser cannot be pointed straight at it — a
     * top-level navigation carries no Authorization header and would only ever get
     * a 401 back. The client fetches this, then navigates to the URL itself.
     */
    @Route(githubRoutes.oauthStart)
    @Middleware(AuthenticatedRoute)
    start(@CurrentUser() userId: number){
        return { url: this.#oauth.startUrl(this.#state.issue(userId)) };
    }

    @Route(githubRoutes.oauthCallback)
    async callback(@Query() query: GithubOAuthCallbackQuery){
        const userId = this.#state.consume(query.state ?? '');
        if(!query.code) throw GithubError.ExchangeFailed();

        const accessToken = await this.#oauth.exchange(query.code);
        const profile = await this.#accounts.fetchProfile(accessToken);
        await this.#accounts.upsertFromGithub(userId, profile, accessToken);

        return new RedirectResponse(`${config.clientHost}/github/authenticate`);
    }

    @Route(githubRoutes.account)
    @Middleware(AuthenticatedRoute)
    account(@CurrentUser() userId: number){
        return this.#accounts.requireForUser(userId);
    }

    @Route(githubRoutes.repositories)
    @Middleware(AuthenticatedRoute)
    repositories(@CurrentUser() userId: number){
        return this.#repositories.listMyRepositories(userId);
    }

    @Route(githubRoutes.detect)
    @Middleware(AuthenticatedRoute)
    detect(@CurrentUser() userId: number, @Param('owner') owner: string, @Param('repo') repo: string){
        return this.#repositories.detect(userId, owner, repo);
    }
}
