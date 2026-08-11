import { MiddlewareFn } from '@/shared/middlewares/Middleware';
import { createParamDecorator } from '@/shared/controllers/params';
import { parseId } from '@/shared/controllers/parseId';
import { principalId } from '@/modules/auth/middlewares/principalId';
import { TenancyError } from '@/modules/organization/contracts/domain/errors';
import RepositoryService from '../services/RepositoryService';
import { RepositoryError } from '../contracts/domain/errors';

export const RepositoryOwnershipRoute: MiddlewareFn = async (req) => {
    if(!req.tenant) throw TenancyError.ContextMissing();
    const id = parseId((req.params as Record<string, string>).id);
    req.repository = await new RepositoryService().getOwned(principalId(req), req.tenant, id);
};

export const OwnedRepository = (): ParameterDecorator => createParamDecorator((req) => {
    if(!req.repository) throw RepositoryError.NotFound();
    return req.repository;
});
