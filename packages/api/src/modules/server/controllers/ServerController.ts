import BaseController from '@/shared/controllers/BaseController';
import { Route } from '@/shared/controllers/Route';
import { Middleware } from '@/shared/middlewares/Middleware';
import { AuthenticatedRoute } from '@/modules/auth/middlewares/AuthenticatedRoute';
import { publicAddress } from '@/modules/deployment/orchestrator/publicAddress';
import HealthService from '../services/HealthService';
import { serverRoutes } from '@quantum/contracts/modules/server/routes';

export default class ServerController extends BaseController{
    #health = new HealthService();

    @Route(serverRoutes.health)
    health(){
        return this.#health.snapshot();
    }

    @Route(serverRoutes.publicAddress)
    @Middleware(AuthenticatedRoute)
    async publicAddress(){
        return { host: await publicAddress() };
    }
}
