import mongoose, { Schema } from 'mongoose';

export const MetricSchema = new Schema({
    organization: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Organization',
        index: true
    },
    container: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'DockerContainer'
    },
    repository: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Repository'
    },
    project: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Project'
    },
    environment: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Environment'
    },
    user: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
    },
    nodeId: {
        type: String,
        default: 'local'
    },
    cpuPercent: { type: Number, default: 0 },
    memUsage: { type: Number, default: 0 },
    memLimit: { type: Number, default: 0 },
    memPercent: { type: Number, default: 0 },
    netRx: { type: Number, default: 0 },
    netTx: { type: Number, default: 0 },
    blkRead: { type: Number, default: 0 },
    blkWrite: { type: Number, default: 0 },
    pids: { type: Number, default: 0 },
    ts: {
        type: Date,
        default: Date.now
    }
}, {
    capped: {
        size: Number(process.env.METRICS_CAPPED_BYTES) || 52428800,
        max: Number(process.env.METRICS_CAPPED_DOCS) || 100000
    }
});

MetricSchema.index({ container: 1, ts: -1 });
MetricSchema.index({ project: 1, ts: -1 });
MetricSchema.index({ organization: 1, ts: -1 });

const Metric = mongoose.model('Metric', MetricSchema);

export default Metric;
