import mongoose, { InferSchemaType, HydratedDocument, Model, Schema } from 'mongoose';

export const EnvironmentSchema = new Schema({
    name: {
        type: String,
        required: [true, 'Environment::Name::Required'],
        trim: true
    },
    type: {
        type: String,
        enum: ['production', 'staging', 'preview'],
        default: 'production'
    },
    project: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Project',
        required: [true, 'Environment::Project::Required']
    },
    organization: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Organization',
        required: [true, 'Environment::Organization::Required'],
        index: true
    },
    isDefault: {
        type: Boolean,
        default: false
    },
    createdAt: {
        type: Date,
        default: Date.now
    }
});

EnvironmentSchema.index({ project: 1, name: 1 }, { unique: true });
EnvironmentSchema.index({ project: 1 });

export type IEnvironment = HydratedDocument<InferSchemaType<typeof EnvironmentSchema>>;

const Environment: Model<IEnvironment> = mongoose.model<IEnvironment>('Environment', EnvironmentSchema);

export default Environment;
