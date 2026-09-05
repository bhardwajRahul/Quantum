import { ownedEntity } from '@/shared/middlewares/ownedEntity';
import { createParamDecorator } from '@/shared/controllers/params';
import RepositoryService from '../services/RepositoryService';
import { RepositoryError } from '../contracts/domain/errors';
import type Repository from '../models/Repository';

export const RepositoryOwnershipRoute = ownedEntity<Repository>({
    load: (userId, tenant, id) => new RepositoryService().getOwned(userId, tenant, id),
    assign: (req, repository) => {
        req.repository = repository;
    },
    missing: RepositoryError.NotFound
});

export const OwnedRepository = (): ParameterDecorator => createParamDecorator((req) => {
    if(!req.repository) throw RepositoryError.NotFound();
    return req.repository;
});
