import BaseController from '@/shared/controllers/BaseController';
import { parseId } from '@/shared/controllers/parseId';
import { RouteError } from '@/shared/errors/RouteError';
import TemplateInstallService from '../services/TemplateInstallService';
import { templateInstallRoutes } from '@quantum/contracts/modules/template/routes';
import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';

const header = (req: FastifyRequest, name: string): string | undefined => {
    const value = req.headers[name];
    return typeof value === 'string' ? value : undefined;
};

export default class TemplateInstallHookController extends BaseController{
    #service = new TemplateInstallService();

    async register(app: FastifyInstance, prefix: string){
        const route = templateInstallRoutes.githubHook;
        if(!route.path.startsWith(`${prefix}/`)) throw RouteError.PrefixMismatch(route.path);

        app.route({
            method: route.method,
            url: route.path,
            handler: (req, reply) => this.#handle(req, reply)
        });
    }

    async #handle(req: FastifyRequest, reply: FastifyReply){
        const id = parseId((req.params as Record<string, string>).id);
        const decision = await this.#service.githubHook(
            id,
            header(req, 'x-github-event'),
            header(req, 'x-hub-signature-256'),
            req.rawBody,
            req.body
        );
        reply.status(decision.status).send({ data: decision.outcome });
    }
}
