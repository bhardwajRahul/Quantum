import Fastify, { type FastifyInstance, type FastifyBaseLogger } from 'fastify';
import cors from '@fastify/cors';
import multipart from '@fastify/multipart';
import websocket from '@fastify/websocket';
import { DataSource } from 'typeorm';
import { config } from '@/shared/config';
import { createDataSource } from '@/core/models/data-source';
import ModuleDiscovery, { type MountedController } from '@/core/modules/discovery';
import { logger } from '@/shared/utils/Logger';
import type { LogLevel } from '@/shared/contracts/logging';
import { registerEventGroup } from '@/shared/events/registerEventGroup';
import RuntimeError from '@/shared/errors/RuntimeError';
import ValidationError from '@/shared/errors/ValidationError';
import { ApiError } from '@quantum/contracts/shared/http';
import type { HttpMethod } from '@quantum/contracts/shared/routing';
import type BaseGateway from '@/shared/gateways/BaseGateway';

const CORS_METHODS: HttpMethod[] = ['GET', 'HEAD', 'POST', 'PUT', 'PATCH', 'DELETE'];

export default class Application{
    #app!: FastifyInstance;
    #dataSource?: DataSource;

    get dataSource(): DataSource | undefined{
        return this.#dataSource;
    }

    async build(): Promise<FastifyInstance>{
        logger.configure({ level: config.log.level as LogLevel, pretty: config.log.pretty });
        this.#app = Fastify({
            loggerInstance: logger.raw as FastifyBaseLogger,
            disableRequestLogging: true
        });

        this.#registerRawBodyCapture();

        await this.#app.register(cors, {
            origin: config.corsOrigins,
            credentials: true,
            methods: CORS_METHODS
        });
        await this.#app.register(multipart, {
            limits: { fileSize: config.maxUploadBytes }
        });
        await this.#app.register(websocket);

        const { controllers, entities, events, gateways } = await new ModuleDiscovery().discover();

        this.#dataSource = createDataSource(entities);
        await this.#dataSource.initialize();

        this.#registerErrorHandler();
        this.#registerRequestLogging();
        await this.#mountControllers(controllers);
        this.#mountGateways(gateways);
        events.forEach(registerEventGroup);

        return this.#app;
    }

    async start(){
        await this.build();
        await this.#app.listen({ port: config.port, host: '0.0.0.0' });
    }

    async stop(){
        await this.#app.close();
        await this.#dataSource?.destroy();
    }

    #registerRawBodyCapture(){
        this.#app.addContentTypeParser('application/json', { parseAs: 'buffer' }, (req, body: Buffer, done) => {
            req.rawBody = body;
            try{
                done(null, JSON.parse(body.toString('utf8')));
            }catch{
                done(new RuntimeError('Request::ValidationFailed', 400), undefined);
            }
        });
    }

    #registerErrorHandler(){
        this.#app.setErrorHandler((err, req, reply) => {
            const status = err instanceof RuntimeError ? err.statusCode : 500;
            const message = err instanceof Error ? err.message : 'Internal Server Error';

            if(status >= 500){
                logger.error(`${req.method} ${req.url}`, err, { scope: 'http', statusCode: status });
            }

            const payload: ApiError = { error: message };
            if(err instanceof ValidationError) payload.errors = err.errors;

            reply.status(status).send(payload);
        });
    }

    #registerRequestLogging(){
        this.#app.addHook('onResponse', (req, reply, done) => {
            logger.debug(`${req.method} ${req.url}`, {
                scope: 'http',
                statusCode: reply.statusCode,
                ms: Math.round(reply.elapsedTime)
            });
            done();
        });
    }

    async #mountControllers(controllers: MountedController[]){
        for(const { prefix, Controller } of controllers){
            await new Controller().register(this.#app, prefix);
        }
    }

    #mountGateways(gateways: Array<new () => BaseGateway>){
        for(const Gateway of gateways){
            new Gateway().register(this.#app);
        }
    }
}
