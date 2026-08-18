import HealthCheck from '@models/healthCheck';
import HandlerFactory from '@controllers/common/handlerFactory';
import { catchAsync } from '@utilities/helpers';
import { resolveRepositoryOr403 } from '@middlewares/tenancy';
import { IRequest } from '@typings/controllers/common';
import { Response, NextFunction } from 'express';

const HealthCheckFactory = new HandlerFactory({
    model: HealthCheck,
    scope: { field: 'organization' },
    fields: ['type', 'path', 'port', 'command', 'intervalSec', 'timeoutSec', 'healthyThreshold', 'unhealthyThreshold', 'enabled', 'autoRestart', 'gateDeploy']
});

export const getHealthChecks = HealthCheckFactory.getAll();
export const getHealthCheck = HealthCheckFactory.getOne();
export const updateHealthCheck = HealthCheckFactory.updateOne();
export const deleteHealthCheck = HealthCheckFactory.deleteOne();

export const createHealthCheck = catchAsync(async (req: IRequest, res: Response, next: NextFunction): Promise<void> => {
    const repositoryId = req.params.repositoryId;
    const repository = await resolveRepositoryOr403(req, repositoryId, 'HealthCheck');
    const healthCheck = await HealthCheck.create({
        organization: repository.organization,
        repository: repository._id,
        project: repository.project,
        user: repository.user,
        type: req.body.type || 'http',
        path: req.body.path,
        port: req.body.port,
        command: req.body.command,
        intervalSec: req.body.intervalSec,
        timeoutSec: req.body.timeoutSec,
        healthyThreshold: req.body.healthyThreshold,
        unhealthyThreshold: req.body.unhealthyThreshold,
        enabled: req.body.enabled,
        autoRestart: req.body.autoRestart,
        gateDeploy: req.body.gateDeploy
    });
    res.status(201).json({ status: 'success', data: healthCheck });
});

export default {
    getHealthChecks,
    getHealthCheck,
    createHealthCheck,
    updateHealthCheck,
    deleteHealthCheck
};
