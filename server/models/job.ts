import mongoose, { Model, Schema } from 'mongoose';
import { IJob } from '@typings/models/job';

const JobSchema: Schema<IJob> = new Schema({
    type: {
        type: String,
        enum: [
            'deploy', 'redeploy', 'start', 'stop', 'restart', 'reconcile',
            'build',
            'db:provision', 'db:backup', 'db:restore',
            'metrics:sample', 'health:check',
            'template:install', 'template:uninstall',
            'org:cascade-delete',
            'project:cascade-delete',
            'analytics:sample',
            'codespace:provision', 'codespace:delete'
        ],
        required: [true, 'Job::Type::Required']
    },
    status: {
        type: String,
        enum: ['queued', 'active', 'completed', 'failed', 'delayed', 'canceled'],
        default: 'queued',
        index: true
    },

    nodeId: { type: String, default: 'local', index: true },
    target: {
        user: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
        repository: { type: mongoose.Schema.Types.ObjectId, ref: 'Repository' },
        container: { type: mongoose.Schema.Types.ObjectId, ref: 'DockerContainer' },
        deployment: { type: mongoose.Schema.Types.ObjectId, ref: 'Deployment' },

        project: { type: mongoose.Schema.Types.ObjectId, ref: 'Project' },
        environment: { type: mongoose.Schema.Types.ObjectId, ref: 'Environment' },
        service: { type: mongoose.Schema.Types.ObjectId, ref: 'TemplateInstall' },
        organization: { type: mongoose.Schema.Types.ObjectId, ref: 'Organization' }
    },
    payload: { type: mongoose.Schema.Types.Mixed, default: {} },

    priority: { type: Number, default: 0 },
    attempts: { type: Number, default: 0 },
    maxAttempts: { type: Number, default: () => Number(process.env.JOB_MAX_ATTEMPTS) || 3 },
    backoffMs: { type: Number, default: 5000 },

    runAt: { type: Date, default: Date.now, index: true },

    lockedUntil: { type: Date },
    claimedBy: { type: String },

    idempotencyKey: { type: String },

    lockKey: { type: String, index: true },

    logRef: { type: String },
    result: { type: mongoose.Schema.Types.Mixed },
    error: { type: String }
}, { timestamps: true });

JobSchema.index({ idempotencyKey: 1 }, { unique: true, sparse: true });

JobSchema.index({ status: 1, runAt: 1, priority: -1 });

const Job: Model<IJob> = mongoose.model<IJob>('Job', JobSchema);

export default Job;
