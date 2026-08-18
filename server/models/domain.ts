import mongoose, { InferSchemaType, HydratedDocument, Model, Schema } from 'mongoose';

export const DomainSchema = new Schema({
    repository: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Repository',
        required: [true, 'Domain::Repository::Required']
    },
    organization: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Organization',
        required: [true, 'Domain::Organization::Required'],
        index: true
    },
    project: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Project',
        required: [true, 'Domain::Project::Required']
    },
    user: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
    },
    host: {
        type: String,
        required: [true, 'Domain::Host::Required'],
        trim: true,
        lowercase: true,
        unique: true
    },
    kind: {
        type: String,
        enum: ['custom', 'subdomain'],
        default: 'custom'
    },
    isPrimary: {
        type: Boolean,
        default: false
    },
    tls: {
        type: Boolean,
        default: true
    },
    status: {
        type: String,
        enum: ['pending', 'active', 'error'],
        default: 'pending'
    },
    createdAt: {
        type: Date,
        default: Date.now
    }
});

DomainSchema.index({ repository: 1 });

export type IDomain = HydratedDocument<InferSchemaType<typeof DomainSchema>>;

const Domain: Model<IDomain> = mongoose.model<IDomain>('Domain', DomainSchema);

export default Domain;
