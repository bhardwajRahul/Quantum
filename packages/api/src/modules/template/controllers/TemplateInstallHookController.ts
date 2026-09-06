import BaseController from '@/shared/controllers/BaseController';
import { parseId } from '@/shared/controllers/parseId';
import { RouteError } from '@/shared/errors/RouteError';
import TemplateInstallService from '../services/TemplateInstallService';
import { templateInstallRoutes } from '@quantum/contracts/modules/template/routes';
import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';

export default class TemplateInstallHookController extends BaseController{
    #service = new TemplateInstallService();

    async register(app: FastifyInstance, prefix: string){
        const route = templateInstallRoutes.deployHook;
        if(!route.path.startsWith(`${prefix}/`)) throw RouteError.PrefixMismatch(route.path);

        app.route({
            method: route.method,
            url: route.path,
            handler: (req, reply) => this.#handle(req, reply)
        });
    }

    async #handle(req: FastifyRequest, reply: FastifyReply){
        const params = req.params as Record<string, string>;
        await this.#service.deployHook(parseId(params.id), params.token);
        reply.status(202).send({ data: { queued: true } });
    }
}
