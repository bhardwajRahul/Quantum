import ActivityEvent from '@models/activityEvent';
import { catchAsync } from '@utilities/helpers';
import { IRequest } from '@typings/controllers/common';
import { Response } from 'express';

const MAX_LIMIT = 500;

export const getActivity = catchAsync(async (req: IRequest, res: Response): Promise<void> => {
    const limit = Math.min(Number(req.query.limit) || 100, MAX_LIMIT);
    const filter: Record<string, any> = {};

    if(!req.tenant?.isPlatformAdmin){

        filter.$or = [
            { organization: { $in: req.tenant?.orgIds || [] } },
            { user: req.user?._id }
        ];
    }
    if(req.query.correlationId){
        filter.correlationId = req.query.correlationId;
    }
    if(req.query.minutes){
        filter.ts = { $gte: new Date(Date.now() - Number(req.query.minutes) * 60 * 1000) };
    }

    const events = await ActivityEvent.find(filter)
        .sort({ ts: -1 })
        .limit(limit)
        .lean();

    res.status(200).json({ status: 'success', results: { total: events.length }, data: events });
});

export default { getActivity };
