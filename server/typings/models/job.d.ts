import mongoose, { Document } from 'mongoose';

export type JobType =
    | 'deploy' | 'redeploy' | 'start' | 'stop' | 'restart' | 'reconcile'

    | 'reload'

    | 'build'

    | 'db:provision' | 'db:backup' | 'db:restore'

    | 'metrics:sample' | 'health:check'

    | 'template:install' | 'template:uninstall'

    | 'org:cascade-delete'

    | 'project:cascade-delete'

    | 'analytics:sample'

    | 'codespace:provision' | 'codespace:delete';

export type JobStatus = 'queued' | 'active' | 'completed' | 'failed' | 'delayed' | 'canceled';

export interface IJobTarget{
    user?: string | mongoose.Types.ObjectId | null;
    repository?: string | mongoose.Types.ObjectId | null;
    container?: string | mongoose.Types.ObjectId | null;
    deployment?: string | mongoose.Types.ObjectId | null;
    project?: string | mongoose.Types.ObjectId | null;
    environment?: string | mongoose.Types.ObjectId | null;
    service?: string | mongoose.Types.ObjectId | null;
    organization?: string | mongoose.Types.ObjectId | null;
}

export interface IJob extends Document{
    _id: mongoose.Types.ObjectId;
    type: JobType;
    status: JobStatus;
    nodeId: string;
    target: IJobTarget;
    payload: Record<string, any>;

    priority: number;
    attempts: number;
    maxAttempts: number;
    backoffMs: number;
    runAt: Date;
    lockedUntil?: Date;
    claimedBy?: string;

    idempotencyKey?: string;
    lockKey?: string;

    logRef?: string;
    result?: Record<string, any>;
    error?: string;

    createdAt: Date;
    updatedAt: Date;
}
