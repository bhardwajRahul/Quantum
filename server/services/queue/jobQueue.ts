import Job from '@models/job';
import { IJob, JobType, IJobTarget } from '@typings/models/job';
import logger from '@utilities/logger';

export interface EnqueueInput{
    type: JobType;
    target: IJobTarget;
    payload?: Record<string, any>;
    nodeId?: string;
    idempotencyKey?: string;
    lockKey?: string;
    priority?: number;
    maxAttempts?: number;
    delayMs?: number;
}

export interface JobQueue{
    add(input: EnqueueInput): Promise<IJob>;

    claim(workerId: string, nodeId: string, leaseMs: number): Promise<IJob | null>;

    complete(jobId: string, workerId: string, result?: Record<string, any>): Promise<boolean>;

    fail(jobId: string, workerId: string, error: string): Promise<boolean>;

    heartbeat(jobId: string, workerId: string, leaseMs: number): Promise<boolean>;

    sweep(): Promise<number>;
}

export class MongoJobQueue implements JobQueue{
    async add(input: EnqueueInput): Promise<IJob>{
        const now = Date.now();
        const doc: Record<string, any> = {
            type: input.type,
            target: input.target || {},
            payload: input.payload || {},
            nodeId: input.nodeId || 'local',
            priority: input.priority ?? 0,
            runAt: new Date(now + (input.delayMs || 0)),
            status: 'queued'
        };
        if(input.idempotencyKey) doc.idempotencyKey = input.idempotencyKey;
        if(input.lockKey) doc.lockKey = input.lockKey;
        if(input.maxAttempts !== undefined) doc.maxAttempts = input.maxAttempts;

        if(input.idempotencyKey){

            const IN_FLIGHT = ['queued', 'delayed', 'active'];
            const existing = await Job.findOne({
                idempotencyKey: input.idempotencyKey,
                status: { $in: IN_FLIGHT }
            });
            if(existing) return existing;

            await Job.updateMany(
                { idempotencyKey: input.idempotencyKey, status: { $nin: IN_FLIGHT } },
                { $unset: { idempotencyKey: '' } }
            );
            try{
                return await Job.create(doc);
            }catch(error: any){

                if(error?.code === 11000){
                    const found = await Job.findOne({
                        idempotencyKey: input.idempotencyKey,
                        status: { $in: IN_FLIGHT }
                    });
                    if(found) return found;
                }
                throw error;
            }
        }
        return await Job.create(doc);
    }

    async claim(workerId: string, nodeId: string, leaseMs: number): Promise<IJob | null>{
        const now = new Date();

        const activeLocks = await Job.distinct('lockKey', {
            status: 'active',
            nodeId,
            lockKey: { $ne: null },
            lockedUntil: { $gt: now }
        });

        const claimable = {
            nodeId,
            runAt: { $lte: now },
            $or: [
                { status: 'queued' },

                { status: 'active', lockedUntil: { $lte: now } }
            ],
            lockKey: { $nin: activeLocks }
        };

        const job = await Job.findOneAndUpdate(
            claimable,
            {
                $set: {
                    status: 'active',
                    claimedBy: workerId,
                    lockedUntil: new Date(now.getTime() + leaseMs)
                },
                $inc: { attempts: 1 }
            },
            { sort: { priority: -1, runAt: 1 }, new: true }
        );
        return job;
    }

    async complete(jobId: string, workerId: string, result?: Record<string, any>): Promise<boolean>{
        const res = await Job.updateOne(
            { _id: jobId, claimedBy: workerId },
            { $set: { status: 'completed', result: result || {}, lockedUntil: null } }
        );
        return (res.matchedCount || 0) > 0;
    }

    async fail(jobId: string, workerId: string, error: string): Promise<boolean>{

        const job = await Job.findOne({ _id: jobId, claimedBy: workerId });
        if(!job) return false;
        if(job.attempts < job.maxAttempts){

            const delay = job.backoffMs * Math.pow(2, Math.max(0, job.attempts - 1));
            const res = await Job.updateOne(
                { _id: jobId, claimedBy: workerId },
                {
                    $set: {
                        status: 'delayed',
                        error,
                        runAt: new Date(Date.now() + delay),
                        lockedUntil: null,
                        claimedBy: null
                    }
                }
            );
            logger.warn(`@services/queue: job ${jobId} failed (attempt ${job.attempts}/${job.maxAttempts}), retrying in ${delay}ms`);
            return (res.matchedCount || 0) > 0;
        }
        const res = await Job.updateOne(
            { _id: jobId, claimedBy: workerId },
            { $set: { status: 'failed', error, lockedUntil: null, claimedBy: null } }
        );
        logger.error(`@services/queue: job ${jobId} permanently failed after ${job.attempts} attempts: ${error}`);
        return (res.matchedCount || 0) > 0;
    }

    async heartbeat(jobId: string, workerId: string, leaseMs: number): Promise<boolean>{

        const res = await Job.updateOne(
            { _id: jobId, claimedBy: workerId },
            { $set: { lockedUntil: new Date(Date.now() + leaseMs) } }
        );
        return (res.matchedCount || 0) > 0;
    }

    async sweep(): Promise<number>{
        const res = await Job.updateMany(
            { status: 'delayed', runAt: { $lte: new Date() } },
            { $set: { status: 'queued' } }
        );
        return res.modifiedCount || 0;
    }
}

export default MongoJobQueue;
