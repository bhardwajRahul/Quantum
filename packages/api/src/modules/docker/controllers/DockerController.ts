import BaseController from '@/shared/controllers/BaseController';
import { Middleware } from '@/shared/middlewares/Middleware';
import { AuthenticatedRoute } from '@/modules/auth/middlewares/AuthenticatedRoute';
import { PlatformAdminRoute } from '@/modules/auth/middlewares/PlatformAdminRoute';
import ContainerService from '../services/ContainerService';
import ImageService from '../services/ImageService';
import NetworkService from '../services/NetworkService';

@Middleware(AuthenticatedRoute, PlatformAdminRoute)
export default class DockerController extends BaseController{
    #containers = new ContainerService();
    #images = new ImageService();
    #networks = new NetworkService();
}
