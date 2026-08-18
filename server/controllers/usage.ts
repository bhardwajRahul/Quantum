import mongoose from 'mongoose';
import Metric from '@models/metric';
import { catchAsync } from '@utilities/helpers';
import { IRequest } from '@typings/controllers/common';
import { Response, NextFunction } from 'express';

const MAX_MINUTES = 43200;

const resolveWindow = (req: IRequest): { since: Date } => {
    const minutes = Math.min(Number(req.query.minutes) || 1440, MAX_MINUTES);
    const since = new Date(Date.now() - minutes * 60 * 1000);
    return { since };
};

const scopedOrgIds = (req: IRequest): mongoose.Types.ObjectId[] => {
    if(req.tenant?.org?._id) return [req.tenant.org._id as mongoose.Types.ObjectId];
    return (req.tenant?.orgIds || []) as mongoose.Types.ObjectId[];
};

export const getNetwork = catchAsync(async (req: IRequest, res: Response, next: NextFunction): Promise<void> => {
    const { since } = resolveWindow(req);
    const orgIds = scopedOrgIds(req);

    const rows = await Metric.aggregate([
        { $match: { organization: { $in: orgIds }, ts: { $gte: since }, project: { $exists: true, $ne: null } } },
        { $group: {
            _id: '$container',
            maxRx: { $max: '$netRx' },
            minRx: { $min: '$netRx' },
            maxTx: { $max: '$netTx' },
            minTx: { $min: '$netTx' },
            project: { $first: '$project' }
        } },
        { $project: {
            project: 1,
            incoming: { $subtract: ['$maxRx', '$minRx'] },
            outgoing: { $subtract: ['$maxTx', '$minTx'] }
        } },
        { $group: {
            _id: '$project',
            incoming: { $sum: '$incoming' },
            outgoing: { $sum: '$outgoing' }
        } },
        { $lookup: { from: 'projects', localField: '_id', foreignField: '_id', as: 'project' } },
        { $unwind: { path: '$project', preserveNullAndEmptyArrays: true } },
        { $project: {
            _id: 0,
            projectId: '$_id',
            projectName: { $ifNull: ['$project.name', 'Unknown'] },
            incoming: 1,
            outgoing: 1
        } },
        { $sort: { outgoing: -1, incoming: -1 } }
    ]);

    res.status(200).json({ status: 'success', results: { total: rows.length }, data: rows });
});

export const getResources = catchAsync(async (req: IRequest, res: Response, next: NextFunction): Promise<void> => {
    const { since } = resolveWindow(req);
    const orgIds = scopedOrgIds(req);

    const rows = await Metric.aggregate([
        { $match: { organization: { $in: orgIds }, ts: { $gte: since }, project: { $exists: true, $ne: null } } },
        { $group: {
            _id: '$project',
            avgCpu: { $avg: '$cpuPercent' },
            avgMem: { $avg: '$memPercent' },
            maxMem: { $max: '$memUsage' }
        } },
        { $lookup: { from: 'projects', localField: '_id', foreignField: '_id', as: 'project' } },
        { $unwind: { path: '$project', preserveNullAndEmptyArrays: true } },
        { $project: {
            _id: 0,
            projectId: '$_id',
            projectName: { $ifNull: ['$project.name', 'Unknown'] },
            avgCpu: 1,
            avgMem: 1,
            maxMem: 1
        } },
        { $sort: { avgCpu: -1 } }
    ]);

    res.status(200).json({ status: 'success', results: { total: rows.length }, data: rows });
});

export default {
    getNetwork,
    getResources
};
