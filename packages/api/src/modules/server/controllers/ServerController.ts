import BaseController from '@/shared/controllers/BaseController';
import { Route } from '@/shared/controllers/Route';
import HealthService from '../services/HealthService';
import { serverRoutes } from '@quantum/contracts/modules/server/routes';

export default class ServerController extends BaseController{
    #health = new HealthService();

    @Route(serverRoutes.health)
    health(){
        return this.#health.snapshot();
    }
}
