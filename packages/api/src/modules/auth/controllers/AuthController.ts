import BaseController from '@/shared/controllers/BaseController';
import { Route } from '@/shared/controllers/Route';
import { Status } from '@/shared/controllers/Status';
import { Body } from '@/shared/controllers/RequestParams';
import { Middleware } from '@/shared/middlewares/Middleware';
import { RateLimit } from '@/shared/middlewares/RateLimit';
import { AuthenticatedRoute } from '../middlewares/AuthenticatedRoute';
import { CurrentUser } from '../middlewares/CurrentUser';
import { ClientIp } from '../middlewares/ClientIp';
import AuthService from '../services/AuthService';
import { authRoutes } from '@quantum/contracts/modules/auth/routes';
import type { SignInInput, SignUpInput, UpdatePasswordInput } from '@quantum/contracts/modules/auth/http';
import type { UpdateMyAccountInput } from '@quantum/contracts/modules/user/http';

export default class AuthController extends BaseController{
    #service = new AuthService();

    @Route(authRoutes.signIn)
    @RateLimit({ max: 100, window: '15m' })
    signIn(@Body() body: SignInInput, @ClientIp() clientIp: string){
        return this.#service.signIn(body, clientIp);
    }

    @Route(authRoutes.signUp)
    @RateLimit({ max: 100, window: '15m' })
    @Status(201)
    signUp(@Body() body: SignUpInput){
        return this.#service.signUp(body);
    }

    @Route(authRoutes.signOut)
    @Middleware(AuthenticatedRoute)
    signOut(){
        return null;
    }

    @Route(authRoutes.me)
    @Middleware(AuthenticatedRoute)
    me(@CurrentUser() userId: number){
        return this.#service.getMe(userId);
    }

    @Route(authRoutes.updateMe)
    @Middleware(AuthenticatedRoute)
    updateMe(@CurrentUser() userId: number, @Body() body: UpdateMyAccountInput){
        return this.#service.updateMe(userId, body);
    }

    @Route(authRoutes.deleteMe)
    @Middleware(AuthenticatedRoute)
    deleteMe(@CurrentUser() userId: number){
        return this.#service.deleteMe(userId);
    }

    @Route(authRoutes.updatePassword)
    @Middleware(AuthenticatedRoute)
    updatePassword(@CurrentUser() userId: number, @Body() body: UpdatePasswordInput){
        return this.#service.updatePassword(userId, body);
    }
}
