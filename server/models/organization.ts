import mongoose, { Model, Schema } from 'mongoose';
import { IOrganization } from '@typings/models/organization';

const OrganizationSchema: Schema<IOrganization> = new Schema({
    name: {
        type: String,
        required: [true, 'Organization::Name::Required'],
        trim: true,
        maxlength: 64
    },
    slug: {
        type: String,
        required: [true, 'Organization::Slug::Required'],
        lowercase: true,
        trim: true
    },
    owner: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: [true, 'Organization::Owner::Required']
    },
    isPersonal: {
        type: Boolean,
        default: false
    },
    createdAt: {
        type: Date,
        default: Date.now
    }
});

OrganizationSchema.index({ slug: 1 }, { unique: true });
OrganizationSchema.index({ owner: 1 });
OrganizationSchema.index({ name: 'text' });

const Organization: Model<IOrganization> = mongoose.model<IOrganization>('Organization', OrganizationSchema);

export default Organization;
