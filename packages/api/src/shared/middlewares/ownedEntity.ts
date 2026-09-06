import { FastifyRequest } from 'fastify';
import { MiddlewareFn } from './Middleware';
import { parseId } from '@/shared/controllers/parseId';
import { principalId } from '@/modules/auth/middlewares/principalId';
import { TenancyError } from '@/modules/organization/contracts/domain/errors';
import type { Tenant } from '@/modules/organization/contracts/types/fastify';

interface OwnedEntityOptions<T>{
    parse?: (req: FastifyRequest) => number;
    load: (userId: number, tenant: Tenant, id: number) => Promise<T>;
    assign: (req: FastifyRequest, entity: T) => void;
    missing: () => Error;
}

export const ownedEntity = <T>({ parse, load, assign, missing }: OwnedEntityOptions<T>): MiddlewareFn =>
    async (req) => {
        if(!req.tenant) throw TenancyError.ContextMissing();
        const id = parse === undefined ? parseId((req.params as Record<string, string>).id) : parse(req);
        const entity = await load(principalId(req), req.tenant, id);
        if(entity === null || entity === undefined) throw missing();
        assign(req, entity);
    };
