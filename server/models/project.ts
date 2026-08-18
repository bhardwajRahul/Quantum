import mongoose, { InferSchemaType, HydratedDocument, Model, Schema } from 'mongoose';

export const ProjectSchema = new Schema({
    name: {
        type: String,
        required: [true, 'Project::Name::Required'],
        trim: true,
        maxlength: 64
    },
    slug: {
        type: String,
        required: [true, 'Project::Slug::Required'],
        lowercase: true,
        trim: true
    },
    organization: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Organization',
        required: [true, 'Project::Organization::Required']
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

ProjectSchema.index({ organization: 1, slug: 1 }, { unique: true });
ProjectSchema.index({ organization: 1 });

export type IProject = HydratedDocument<InferSchemaType<typeof ProjectSchema>>;

const Project: Model<IProject> = mongoose.model<IProject>('Project', ProjectSchema);

export default Project;
