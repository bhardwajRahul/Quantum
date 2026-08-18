import mongoose, { Schema } from 'mongoose';

export const HealthCheckSchema = new Schema({
    organization: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Organization',
        required: [true, 'HealthCheck::Organization::Required'],
        index: true
    },
    repository: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Repository',
        required: [true, 'HealthCheck::Repository::Required']
    },
    project: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Project'
    },
    user: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
    },
    nodeId: {
        type: String,
        default: 'local'
    },
    type: {
        type: String,
        enum: ['http', 'tcp', 'cmd'],
        default: 'http'
    },
    path: {
        type: String,
        default: '/'
    },
    port: {
        type: Number
    },
    command: {
        type: String
    },
    intervalSec: {
        type: Number,
        default: 30
    },
    timeoutSec: {
        type: Number,
        default: 5
    },
    healthyThreshold: {
        type: Number,
        default: 2
    },
    unhealthyThreshold: {
        type: Number,
        default: 3
    },
    enabled: {
        type: Boolean,
        default: true
    },
    autoRestart: {
        type: Boolean,
        default: false
    },
    gateDeploy: {
        type: Boolean,
        default: false
    },
    status: {
        type: String,
        enum: ['healthy', 'unhealthy', 'unknown'],
        default: 'unknown'
    },
    consecutiveFailures: {
        type: Number,
        default: 0
    },
    consecutiveSuccesses: {
        type: Number,
        default: 0
    },
    lastCheckedAt: {
        type: Date
    },
    lastError: {
        type: String
    },
    createdAt: {
        type: Date,
        default: Date.now
    }
});

HealthCheckSchema.index({ repository: 1 });

const HealthCheck = mongoose.model('HealthCheck', HealthCheckSchema);

export default HealthCheck;
