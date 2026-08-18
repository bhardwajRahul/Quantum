import mongoose, { Schema } from 'mongoose';

export const ActivityEventSchema = new Schema({
    organization: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Organization',
        index: true
    },
    user: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        index: true
    },

    scope: { type: String },
    level: {
        type: String,
        enum: ['info', 'success', 'progress', 'warn', 'error'],
        default: 'info'
    },
    title: { type: String },
    message: { type: String },

    source: { type: String },

    correlationId: { type: String },
    meta: { type: mongoose.Schema.Types.Mixed, default: {} },
    ts: { type: Date, default: Date.now }
});

ActivityEventSchema.index({ organization: 1, ts: -1 });
ActivityEventSchema.index({ user: 1, ts: -1 });
ActivityEventSchema.index({ correlationId: 1, ts: 1 });

ActivityEventSchema.index(
    { ts: 1 },
    { expireAfterSeconds: Number(process.env.ACTIVITY_RETENTION_SECONDS) || 2592000 }
);

const ActivityEvent = mongoose.model('ActivityEvent', ActivityEventSchema);

export default ActivityEvent;
