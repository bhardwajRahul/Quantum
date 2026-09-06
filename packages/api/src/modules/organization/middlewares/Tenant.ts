import { createParamDecorator } from '@/shared/controllers/params';
import { TenancyError } from '../contracts/domain/errors';
import type { Tenant as RequestTenant } from '../contracts/types/fastify';

export type Tenant = RequestTenant;

export const Tenant = (): ParameterDecorator => createParamDecorator((req) => {
    if(!req.tenant) throw TenancyError.ContextMissing();
    return req.tenant;
});
