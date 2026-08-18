import mongoose from 'mongoose';
import { io } from '@config/express';
import { userRoom } from '@services/orchestrator/events';
import ActivityEvent from '@models/activityEvent';
import logger from '@utilities/logger';
import { ActivityLevel } from '@typings/models/activityEvent';
import { ActivityReporter } from '@typings/services/activity';

export interface ActivityPayload{
    userId?: string;
    organization?: string;
    scope: string;
    level?: ActivityLevel;
    title: string;
    message?: string;
    source?: string;
    correlationId?: string;
    meta?: Record<string, any>;
}

export const emitActivity = (a: ActivityPayload): void => {

    const _id = new mongoose.Types.ObjectId();
    const doc = {
        _id,
        level: 'info' as ActivityLevel,
        meta: {},
        ...a,
        ts: new Date()
    };

    try{
        if(a.userId) io.to(userRoom(a.userId)).emit('activity', doc);
    }catch(error){
        logger.error('@services/activity (emit): ' + error);
    }

    const { userId, ...rest } = doc;
    ActivityEvent.create({ ...rest, user: userId }).catch((error) =>
        logger.error('@services/activity (persist): ' + error));
};

export interface ActivityContextBase{
    userId?: string;
    organization?: string;
    scope: string;
    source?: string;
    correlationId?: string;
    meta?: Record<string, any>;
}

export interface ActivityContext extends ActivityReporter{
    info: (title: string, message?: string, meta?: Record<string, any>) => void;
    success: (title: string, message?: string, meta?: Record<string, any>) => void;
    warn: (title: string, message?: string, meta?: Record<string, any>) => void;
    fail: (title: string, error?: any, meta?: Record<string, any>) => void;
}

export const createActivityContext = (base: ActivityContextBase): ActivityContext => {
    let stepIndex = 0;
    const at = (level: ActivityLevel, title: string, message?: string, meta?: Record<string, any>) =>
        emitActivity({
            userId: base.userId,
            organization: base.organization,
            scope: base.scope,
            source: base.source,
            correlationId: base.correlationId,
            level,
            title,
            message,
            meta: { ...(base.meta || {}), ...(meta || {}) }
        });

    return {
        progress: (title, meta) => at('progress', title, undefined, meta),
        info: (title, message, meta) => at('info', title, message, meta),
        success: (title, message, meta) => at('success', title, message, meta),
        warn: (title, message, meta) => at('warn', title, message, meta),
        fail: (title, error, meta) => at('error', title, error?.message || (error ? String(error) : undefined), meta),
        step: async <T>(name: string, fn: () => Promise<T>): Promise<T> => {
            const n = ++stepIndex;
            const startedAt = Date.now();
            at('progress', name, undefined, { stepIndex: n });
            try{
                const result = await fn();
                at('success', name, undefined, { stepIndex: n, durationMs: Date.now() - startedAt });
                return result;
            }catch(error: any){
                at('error', name, error?.message || String(error), { stepIndex: n, durationMs: Date.now() - startedAt });
                throw error;
            }
        }
    };
};

export const activityContextFromJob = (job: any): ActivityContext => createActivityContext({
    userId: job?.target?.user?.toString(),
    organization: job?.target?.organization?.toString(),
    correlationId: job?._id?.toString(),
    scope: String(job?.type || 'job').split(':')[0],
    source: `${job?.type}:${job?._id?.toString()}`,
    meta: { jobType: job?.type }
});

export default { emitActivity, createActivityContext, activityContextFromJob };
