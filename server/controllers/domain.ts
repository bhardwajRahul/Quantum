import Domain from '@models/domain';
import Repository from '@models/repository';
import HandlerFactory from '@controllers/common/handlerFactory';
import { catchAsync } from '@utilities/helpers';
import { resolveRepositoryOr403 } from '@middlewares/tenancy';
import { applyIngress } from '@services/orchestrator/handlers/ingressHandler';
import { IRequest } from '@typings/controllers/common';
import { IRepository } from '@typings/models/repository';
import { Response, NextFunction } from 'express';
import logger from '@utilities/logger';

const DomainFactory = new HandlerFactory({
    model: Domain,
    scope: { field: 'organization' },
    fields: ['isPrimary', 'tls', 'status']
});

export const getDomains = DomainFactory.getAll();
export const getDomain = DomainFactory.getOne();
export const updateDomain = DomainFactory.updateOne();

const kickIngress = (repository: IRepository): void => {
    applyIngress(repository).catch((error) =>
        logger.warn('@controllers/domain (kickIngress): ' + error));
};

export const createDomain = catchAsync(async (req: IRequest, res: Response, next: NextFunction): Promise<void> => {
    const repositoryId = req.params.repositoryId;
    const repository = await resolveRepositoryOr403(req, repositoryId, 'Domain');

    const existingCount = await Domain.countDocuments({ repository: repository._id });
    const domain = await Domain.create({
        repository: repository._id,
        organization: repository.organization,
        project: repository.project,
        user: repository.user,
        host: req.body.host,
        kind: 'custom',
        isPrimary: req.body.isPrimary ?? existingCount === 0,
        tls: req.body.tls ?? true,
        status: 'pending'
    });
    kickIngress(repository);
    res.status(201).json({ status: 'success', data: domain });
});

export const deleteDomain = DomainFactory.deleteOne({
    responseInterceptor: async (req: IRequest, res: Response, body: any) => {
        const deleted = body?.data;
        if(deleted?.repository){
            const repository = await Repository.findById(deleted.repository);
            if(repository) kickIngress(repository);
        }
        res.status(204).json(body);
    }
});

export default {
    getDomains,
    getDomain,
    createDomain,
    updateDomain,
    deleteDomain
};
