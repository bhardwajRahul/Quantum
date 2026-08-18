import Metric from '@models/metric';
import DockerContainer from '@models/docker/container';
import RuntimeError from '@utilities/runtimeError';
import { catchAsync } from '@utilities/helpers';
import { resolveRepositoryOr403 } from '@middlewares/tenancy';
import { IRequest } from '@typings/controllers/common';
import { Response, NextFunction } from 'express';

const MAX_WINDOW = 1000;

const resolveWindow = (req: IRequest): { limit: number; since: Date } => {
    const limit = Math.min(Number(req.query.limit) || 200, MAX_WINDOW);
    const minutes = Number(req.query.minutes) || 60;
    const since = new Date(Date.now() - minutes * 60 * 1000);
    return { limit, since };
};

const assertRepositoryAccess = (req: IRequest, repositoryId: string) =>
    resolveRepositoryOr403(req, repositoryId, 'Metric');

export const getContainerMetrics = catchAsync(async (req: IRequest, res: Response, next: NextFunction): Promise<void> => {
    const containerId = req.params.containerId;
    const container = await DockerContainer.findById(containerId).select('user repository');
    if(!container){
        return next(new RuntimeError('Metric::Container::NotFound', 404));
    }
    if(!req.tenant?.isPlatformAdmin){
        const isOwner = String(container.user) === String((req.user as any)?._id);
        if(!isOwner){

            if(!container.repository){
                return next(new RuntimeError('Metric::Container::Forbidden', 403));
            }
            await assertRepositoryAccess(req, container.repository.toString());
        }
    }

    const { limit, since } = resolveWindow(req);
    const metrics = await Metric.find({ container: containerId, ts: { $gte: since } })
        .sort({ ts: -1 })
        .limit(limit)
        .lean();
    res.status(200).json({ status: 'success', results: { total: metrics.length }, data: metrics });
});

export const getRepositoryMetrics = catchAsync(async (req: IRequest, res: Response, next: NextFunction): Promise<void> => {
    const repositoryId = req.params.repositoryId;
    await assertRepositoryAccess(req, repositoryId);

    const { limit, since } = resolveWindow(req);
    const metrics = await Metric.find({ repository: repositoryId, ts: { $gte: since } })
        .sort({ ts: -1 })
        .limit(limit)
        .lean();
    res.status(200).json({ status: 'success', results: { total: metrics.length }, data: metrics });
});

export default {
    getContainerMetrics,
    getRepositoryMetrics
};
