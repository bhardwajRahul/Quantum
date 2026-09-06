import type { FastifyInstance } from 'fastify';
import type { Endpoint } from '@quantum/contracts/shared/routing';
import { request, expectError } from './request';
import type { RequestOptions } from './request';

export const expectUnauthenticated = async <I, O>(
    app: FastifyInstance,
    endpoint: Endpoint<I, O>,
    options: Omit<RequestOptions<I>, 'as'> = {}
): Promise<void> => {
    const res = await request(app, endpoint, options);
    expectError(res, 401, 'Authentication::Unauthorized');
};
