import BaseController from '@/shared/controllers/BaseController';
import { parseId } from '@/shared/controllers/parseId';
import { RouteError } from '@/shared/errors/RouteError';
import WebhookService from '../services/WebhookService';
import { repositoryRoutes } from '@quantum/contracts/modules/repository/routes';
import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';

export default class WebhookController extends BaseController{
    #service = new WebhookService();

    async register(app: FastifyInstance, prefix: string){
        const route = repositoryRoutes.webhook;
        if(!route.path.startsWith(`${prefix}/`)) throw RouteError.PrefixMismatch(route.path);

        app.route({
            method: route.method,
            url: route.path,
            handler: (req, reply) => this.#handle(req, reply)
        });
    }

    async #handle(req: FastifyRequest, reply: FastifyReply){
        const repositoryId = parseId((req.params as Record<string, string>).repositoryId);
        const header = req.headers['x-hub-signature-256'];
        const decision = await this.#service.handle(
            repositoryId,
            typeof header === 'string' ? header : undefined,
            req.rawBody,
            req.body
        );
        reply.status(decision.status).send({ data: decision.outcome });
    }
}
