import mongoose, { Schema } from 'mongoose';

const NumberMap = {
    type: Map,
    of: Number,
    default: () => ({})
};

export const AnalyticsRollupSchema = new Schema({
    organization: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Organization',
        required: [true, 'AnalyticsRollup::Organization::Required'],
        index: true
    },
    domain: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Domain'
    },
    host: { type: String },
    bucket: { type: Date, required: [true, 'AnalyticsRollup::Bucket::Required'] },
    pageviews: { type: Number, default: 0 },
    visitors: { type: Number, default: 0 },
    bounces: { type: Number, default: 0 },
    topPaths: NumberMap,
    topReferrers: NumberMap,
    countries: NumberMap,
    devices: NumberMap,
    browsers: NumberMap,
    os: NumberMap
});

AnalyticsRollupSchema.index({ domain: 1, bucket: 1 }, { unique: true });
AnalyticsRollupSchema.index({ organization: 1, bucket: -1 });

const AnalyticsRollup = mongoose.model('AnalyticsRollup', AnalyticsRollupSchema);

export default AnalyticsRollup;
