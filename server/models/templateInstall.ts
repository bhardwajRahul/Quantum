import mongoose, { InferSchemaType, HydratedDocument, Model, Schema } from 'mongoose';

export const TemplateInstallSchema = new Schema({

    template: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Template'
    },

    templateVersion: {
        type: String,
        default: 'legacy'
    },
    name: {
        type: String,
        required: [true, 'TemplateInstall::Name::Required'],
        trim: true
    },
    organization: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Organization'
    },
    project: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Project',
        required: [true, 'TemplateInstall::Project::Required']
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
        default: 'local',
        index: true
    },

    inputs: {
        type: Map,
        of: String,
        default: () => new Map()
    },

    services: [{
        name: { type: String, required: true },
        container: { type: mongoose.Schema.Types.ObjectId, ref: 'DockerContainer' },
        role: { type: String, default: 'app' }
    }],
    network: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'DockerNetwork'
    },
    status: {
        type: String,
        enum: ['pending', 'installing', 'running', 'failed', 'removed'],
        default: 'pending',
        index: true
    },

    url: {
        type: String
    }
}, {
    timestamps: true
});

TemplateInstallSchema.index({ project: 1 });
TemplateInstallSchema.index({ template: 1 });

export type ITemplateInstall = HydratedDocument<InferSchemaType<typeof TemplateInstallSchema>>;

const TemplateInstall: Model<ITemplateInstall> = mongoose.model<ITemplateInstall>('TemplateInstall', TemplateInstallSchema);

export default TemplateInstall;
