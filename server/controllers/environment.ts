import Environment from '@models/environment';
import HandlerFactory from '@controllers/common/handlerFactory';
import { resolveProjectOr403 } from '@middlewares/tenancy';
import { catchAsync } from '@utilities/helpers';
import { IRequest } from '@typings/controllers/common';
import { Response, NextFunction } from 'express';

const EnvironmentFactory = new HandlerFactory({
    model: Environment,
    scope: { field: 'organization' },
    fields: ['name', 'type', 'isDefault']
});

export const getEnvironments = EnvironmentFactory.getAll();
export const getEnvironment = EnvironmentFactory.getOne();
export const updateEnvironment = EnvironmentFactory.updateOne();
export const deleteEnvironment = EnvironmentFactory.deleteOne();

export const createEnvironment = catchAsync(async (req: IRequest, res: Response, next: NextFunction): Promise<void> => {
    const project = await resolveProjectOr403(req, next, 'Environment');
    if(!project) return;
    const environment = await Environment.create({
        name: req.body.name,
        type: req.body.type || 'production',
        organization: project.organization,
        project: project._id
    });
    res.status(201).json({ status: 'success', data: environment });
});

export default {
    getEnvironments,
    getEnvironment,
    createEnvironment,
    updateEnvironment,
    deleteEnvironment
};
