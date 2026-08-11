import { FastifyRequest } from 'fastify';
import { AuthError } from '../contracts/domain/errors';

export const principalId = (req: FastifyRequest): number => {
    if(!req.principal) throw AuthError.Unauthorized();
    return req.principal.userId;
};
