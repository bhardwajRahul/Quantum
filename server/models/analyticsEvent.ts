import mongoose, { Schema } from 'mongoose';

export const AnalyticsEventSchema = new Schema({
    organization: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Organization',
        required: [true, 'AnalyticsEvent::Organization::Required'],
        index: true
    },
    domain: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Domain'
    },
    host: { type: String },
    path: { type: String },
    status: { type: Number },
    method: { type: String },
    referrer: { type: String },
    device: {
        type: String,
        enum: ['mobile', 'desktop', 'tablet', 'bot']
    },
    browser: { type: String },
    os: { type: String },
    country: { type: String, maxlength: 2 },
    utmSource: { type: String },
    utmMedium: { type: String },
    utmCampaign: { type: String },
    durationMs: { type: Number },
    ts: {
        type: Date,
        default: Date.now
    }
}, {
    capped: {
        size: Number(process.env.ANALYTICS_CAPPED_BYTES) || 52428800,
        max: Number(process.env.ANALYTICS_CAPPED_DOCS) || 200000
    }
});

AnalyticsEventSchema.index({ organization: 1, ts: -1 });
AnalyticsEventSchema.index({ domain: 1, ts: -1 });
AnalyticsEventSchema.index({ host: 1, ts: -1 });

const AnalyticsEvent = mongoose.model('AnalyticsEvent', AnalyticsEventSchema);

export default AnalyticsEvent;
