import BaseController from '@/shared/controllers/BaseController';
import { Route } from '@/shared/controllers/Route';
import { Body, NumericParam } from '@/shared/controllers/RequestParams';
import { Middleware } from '@/shared/middlewares/Middleware';
import { AuthenticatedRoute } from '@/modules/auth/middlewares/AuthenticatedRoute';
import { PlatformAdminRoute } from '@/modules/auth/middlewares/PlatformAdminRoute';
import ContainerService from '../services/ContainerService';
import ImageService from '../services/ImageService';
import NetworkService from '../services/NetworkService';
import { dockerRoutes } from '@quantum/contracts/modules/docker/routes';
import type { ContainerOperationInput } from '@quantum/contracts/modules/docker/http';

@Middleware(AuthenticatedRoute, PlatformAdminRoute)
export default class DockerController extends BaseController{
    #containers = new ContainerService();
    #images = new ImageService();
    #networks = new NetworkService();

    @Route(dockerRoutes.containers)
    containers(){
        return this.#containers.list();
    }

    @Route(dockerRoutes.container)
    container(@NumericParam('id') id: number){
        return this.#containers.get(id);
    }

    @Route(dockerRoutes.operate)
    operate(@NumericParam('id') id: number, @Body() body: ContainerOperationInput){
        return this.#containers.operate(id, body.operation);
    }

    @Route(dockerRoutes.images)
    images(){
        return this.#images.list();
    }

    @Route(dockerRoutes.networks)
    networks(){
        return this.#networks.list();
    }
}
