import mongoose, { InferSchemaType, HydratedDocument, Model, Schema } from 'mongoose';

export const TemplateSchema = new Schema({
    name: {
        type: String,
        required: [true, 'Template::Name::Required'],
        trim: true
    },

    slug: {
        type: String,
        required: [true, 'Template::Slug::Required'],
        lowercase: true,
        trim: true
    },
    version: {
        type: String,
        required: [true, 'Template::Version::Required'],
        default: '1.0.0'
    },
    category: {
        type: String,
        default: 'other'
    },
    description: {
        type: String
    },
    icon: {
        type: String
    },
    website: {
        type: String
    },
    source: {
        type: String,
        enum: ['builtin', 'custom'],
        default: 'custom'
    },

    organization: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Organization',
        default: null
    },

    spec: {
        type: mongoose.Schema.Types.Mixed,
        required: [true, 'Template::Spec::Required']
    },

    inputsSchema: {
        type: [mongoose.Schema.Types.Mixed],
        default: []
    } as any,
    isLatest: {
        type: Boolean,
        default: true
    }
}, {
    timestamps: true
});

TemplateSchema.index({ slug: 1, version: 1 }, { unique: true });
TemplateSchema.index({ category: 1 });

export type ITemplate = HydratedDocument<InferSchemaType<typeof TemplateSchema>>;

const Template: Model<ITemplate> = mongoose.model<ITemplate>('Template', TemplateSchema);

export default Template;
