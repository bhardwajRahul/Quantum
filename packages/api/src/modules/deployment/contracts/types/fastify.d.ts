import type Deployment from '../../models/Deployment';

declare module 'fastify'{
    interface FastifyRequest{
        deployment?: Deployment;
    }
}
