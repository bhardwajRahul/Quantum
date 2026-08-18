import { Request, Response, NextFunction } from 'express';
import { emitActivity } from '@services/activity';

const VERB: Record<string, string> = {
    POST: 'Created', PUT: 'Updated', PATCH: 'Updated', DELETE: 'Deleted', GET: 'Viewed'
};

const SKIP = /^\/(socket\.io|api\/v1\/(webhook|server\/health|activity))/;

export const httpActivity = (req: Request, res: Response, next: NextFunction): void => {
    const startedAt = Date.now();
    const verbose = process.env.ACTIVITY_HTTP_VERBOSE === 'true';
    const isRead = req.method === 'GET' || req.method === 'HEAD' || req.method === 'OPTIONS';

    if(SKIP.test(req.path) || (isRead && !verbose)){
        return next();
    }

    res.on('finish', () => {
        const user = (req as any).user;
        const tenant = (req as any).tenant;

        if(!user?._id) return;

        const resource = (req.baseUrl || req.path).replace('/api/v1/', '').split('/').filter(Boolean)[0] || 'resource';
        const level = res.statusCode >= 500 ? 'error' : res.statusCode >= 400 ? 'warn' : 'success';

        emitActivity({
            userId: user._id.toString(),

            organization: (tenant?.org?._id || tenant?.orgIds?.[0])?.toString(),
            scope: 'http',
            level,
            title: `${VERB[req.method] || req.method} ${resource}`,
            message: `${req.method} ${req.path} → ${res.statusCode}`,
            source: `${req.method} ${req.baseUrl || req.path}`,
            meta: {
                method: req.method,
                path: req.path,
                status: res.statusCode,
                durationMs: Date.now() - startedAt
            }
        });
    });

    next();
};

export default httpActivity;
