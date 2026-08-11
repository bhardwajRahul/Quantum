import type Repository from '../../models/Repository';

declare module 'fastify'{
    interface FastifyRequest{
        repository?: Repository;
        rawBody?: Buffer;
    }
}
