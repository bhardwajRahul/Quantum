import mongoose from 'mongoose';
import Domain from '@models/domain';
import AnalyticsRollup from '@models/analyticsRollup';
import AnalyticsEvent from '@models/analyticsEvent';
import RuntimeError from '@utilities/runtimeError';
import { catchAsync } from '@utilities/helpers';
import { IRequest } from '@typings/controllers/common';
import { Response, NextFunction } from 'express';

const MAX_MINUTES = 90 * 24 * 60;
const DEFAULT_TOP = 10;

const resolveWindow = (req: IRequest): { since: Date } => {
    const minutes = Math.min(Number(req.query.minutes) || 1440, MAX_MINUTES);
    return { since: new Date(Date.now() - minutes * 60 * 1000) };
};

const buildScope = async (req: IRequest): Promise<Record<string, any>> => {
    const tenant = req.tenant;
    if(!tenant) throw new RuntimeError('Tenancy::Context::Missing', 403);
    const domainId = (req.query.domainId as string | undefined) || undefined;
    const orgIds = (tenant.orgIds || []).map(String);

    if(domainId){
        const domain = await Domain.findById(domainId).select('organization');
        if(!domain) throw new RuntimeError('Analytics::Domain::NotFound', 404);
        if(!tenant.isPlatformAdmin && !orgIds.includes(String(domain.organization))){
            throw new RuntimeError('Analytics::Domain::Forbidden', 403);
        }
        return { domain: new mongoose.Types.ObjectId(domainId) };
    }

    if(tenant.isPlatformAdmin) return {};
    return { organization: { $in: (tenant.orgIds || []) } };
};

const aggregateMap = async (match: Record<string, any>, field: string, limit = DEFAULT_TOP) => {
    const rows = await AnalyticsRollup.aggregate([
        { $match: match },
        { $project: { arr: { $objectToArray: { $ifNull: [`$${field}`, {}] } } } },
        { $unwind: '$arr' },
        { $group: { _id: '$arr.k', value: { $sum: '$arr.v' } } },
        { $sort: { value: -1, _id: 1 } },
        { $limit: limit }
    ]);
    return rows.map((r) => ({ key: r._id, value: r.value }));
};

export const getSummary = catchAsync(async (req: IRequest, res: Response, _next: NextFunction): Promise<void> => {
    const scope = await buildScope(req);
    const { since } = resolveWindow(req);
    const match = { ...scope, bucket: { $gte: since } };

    const [agg] = await AnalyticsRollup.aggregate([
        { $match: match },
        { $group: {
            _id: null,
            pageviews: { $sum: '$pageviews' },
            visitors: { $sum: '$visitors' },
            bounces: { $sum: '$bounces' }
        } }
    ]);

    const pageviews = agg?.pageviews || 0;
    const visitors = agg?.visitors || 0;
    const bounces = agg?.bounces || 0;
    const bounceRate = visitors > 0 ? Math.round((bounces / visitors) * 1000) / 10 : 0;

    res.status(200).json({
        status: 'success',
        data: { pageviews, visitors, bounces, bounceRate }
    });
});

export const getTop = catchAsync(async (req: IRequest, res: Response, _next: NextFunction): Promise<void> => {
    const scope = await buildScope(req);
    const { since } = resolveWindow(req);
    const rollupMatch = { ...scope, bucket: { $gte: since } };

    const hostnamesAgg = await AnalyticsRollup.aggregate([
        { $match: rollupMatch },
        { $group: { _id: '$host', value: { $sum: '$pageviews' } } },
        { $sort: { value: -1, _id: 1 } },
        { $limit: DEFAULT_TOP }
    ]);

    const [paths, referrers, countries, devices, browsers, os] = await Promise.all([
        aggregateMap(rollupMatch, 'topPaths'),
        aggregateMap(rollupMatch, 'topReferrers'),
        aggregateMap(rollupMatch, 'countries'),
        aggregateMap(rollupMatch, 'devices'),
        aggregateMap(rollupMatch, 'browsers'),
        aggregateMap(rollupMatch, 'os')
    ]);

    const eventMatch: Record<string, any> = { ...scope, ts: { $gte: since } };
    const utmTop = async (field: string) => {
        const rows = await AnalyticsEvent.aggregate([
            { $match: { ...eventMatch, [field]: { $nin: [null, ''] } } },
            { $group: { _id: `$${field}`, value: { $sum: 1 } } },
            { $sort: { value: -1, _id: 1 } },
            { $limit: DEFAULT_TOP }
        ]);
        return rows.map((r) => ({ key: r._id, value: r.value }));
    };
    const [utmSource, utmMedium, utmCampaign] = await Promise.all([
        utmTop('utmSource'),
        utmTop('utmMedium'),
        utmTop('utmCampaign')
    ]);

    res.status(200).json({
        status: 'success',
        data: {
            hostnames: hostnamesAgg.map((r) => ({ key: r._id, value: r.value })),
            paths,
            referrers,
            countries,
            devices,
            browsers,
            os,
            utm: { source: utmSource, medium: utmMedium, campaign: utmCampaign }
        }
    });
});

export const getDomains = catchAsync(async (req: IRequest, res: Response, _next: NextFunction): Promise<void> => {
    const tenant = req.tenant;
    if(!tenant) throw new RuntimeError('Tenancy::Context::Missing', 403);
    const filter = tenant.isPlatformAdmin ? {} : { organization: { $in: (tenant.orgIds || []) } };
    const domains = await Domain.find(filter)
        .select('host kind status organization repository')
        .sort({ host: 1 })
        .lean();
    res.status(200).json({ status: 'success', results: { total: domains.length }, data: domains });
});

export default {
    getSummary,
    getTop,
    getDomains
};
