import { MiddlewareFn } from '@/shared/middlewares/Middleware';
import { createParamDecorator } from '@/shared/controllers/params';
import { parseId } from '@/shared/controllers/parseId';
import { principalId } from '@/modules/auth/middlewares/principalId';
import { TenancyError } from '@/modules/organization/contracts/domain/errors';
import DeploymentService from '../services/DeploymentService';
import { DeploymentError } from '../contracts/domain/errors';

export const DeploymentOwnershipRoute: MiddlewareFn = async (req) => {
    if(!req.tenant) throw TenancyError.ContextMissing();
    const id = parseId((req.params as Record<string, string>).id);
    req.deployment = await new DeploymentService().getOwned(principalId(req), req.tenant, id);
};

export const OwnedDeployment = (): ParameterDecorator => createParamDecorator((req) => {
    if(!req.deployment) throw DeploymentError.NotFound();
    return req.deployment;
});
