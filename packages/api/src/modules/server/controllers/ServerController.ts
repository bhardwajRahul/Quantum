import BaseController from '@/shared/controllers/BaseController';
import { Route } from '@/shared/controllers/Route';
import { Middleware } from '@/shared/middlewares/Middleware';
import { AuthenticatedRoute } from '@/modules/auth/middlewares/AuthenticatedRoute';
import HealthService from '../services/HealthService';
import { serverRoutes } from '@quantum/contracts/modules/server/routes';

export default class ServerController extends BaseController{
    #health = new HealthService();

    @Route(serverRoutes.health)
    health(){
        return this.#health.snapshot();
    }

    @Route(serverRoutes.ip)
    @Middleware(AuthenticatedRoute)
    ip(){
        return process.env.SERVER_IP ?? '';
    }
}
