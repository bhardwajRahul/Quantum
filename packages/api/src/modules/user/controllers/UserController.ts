import BaseController from '@/shared/controllers/BaseController';
import { Route } from '@/shared/controllers/Route';
import { Status } from '@/shared/controllers/Status';
import { Body, NumericParam } from '@/shared/controllers/RequestParams';
import { Middleware } from '@/shared/middlewares/Middleware';
import { AuthenticatedRoute } from '@/modules/auth/middlewares/AuthenticatedRoute';
import { PlatformAdminRoute } from '@/modules/auth/middlewares/PlatformAdminRoute';
import UserService from '../services/UserService';
import { userRoutes } from '@quantum/contracts/modules/user/routes';
import type { CreateUserInput, UpdateUserInput } from '@quantum/contracts/modules/user/http';

@Middleware(AuthenticatedRoute, PlatformAdminRoute)
export default class UserController extends BaseController{
    #service = new UserService();

    @Route(userRoutes.list)
    list(){
        return this.#service.list();
    }

    @Route(userRoutes.create)
    @Status(201)
    create(@Body() body: CreateUserInput){
        return this.#service.create(body);
    }

    @Route(userRoutes.get)
    get(@NumericParam('id') id: number){
        return this.#service.get(id);
    }

    @Route(userRoutes.update)
    update(@NumericParam('id') id: number, @Body() body: UpdateUserInput){
        return this.#service.update(id, body);
    }

    @Route(userRoutes.remove)
    async remove(@NumericParam('id') id: number){
        await this.#service.remove(id);
    }
}
