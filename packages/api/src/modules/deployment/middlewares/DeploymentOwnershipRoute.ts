import { ownedEntity } from '@/shared/middlewares/ownedEntity';
import { createParamDecorator } from '@/shared/controllers/params';
import DeploymentService from '../services/DeploymentService';
import { DeploymentError } from '../contracts/domain/errors';
import type Deployment from '../models/Deployment';

export const DeploymentOwnershipRoute = ownedEntity<Deployment>({
    load: (userId, tenant, id) => new DeploymentService().getOwned(userId, tenant, id),
    assign: (req, deployment) => {
        req.deployment = deployment;
    },
    missing: DeploymentError.NotFound
});

export const OwnedDeployment = (): ParameterDecorator => createParamDecorator((req) => {
    if(!req.deployment) throw DeploymentError.NotFound();
    return req.deployment;
});
