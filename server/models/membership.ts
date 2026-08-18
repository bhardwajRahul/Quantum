import mongoose, { InferSchemaType, HydratedDocument, Model, Schema } from 'mongoose';

export const MembershipSchema = new Schema({
    user: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: [true, 'Membership::User::Required']
    },
    organization: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Organization',
        required: [true, 'Membership::Organization::Required']
    },
    project: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Project',
        default: null
    },
    role: {
        type: String,
        enum: ['owner', 'admin', 'member', 'viewer'],
        required: [true, 'Membership::Role::Required']
    },
    createdAt: {
        type: Date,
        default: Date.now
    }
});

MembershipSchema.index({ user: 1, organization: 1, project: 1 }, { unique: true });
MembershipSchema.index({ organization: 1, role: 1 });
MembershipSchema.index({ user: 1 });

export type IMembership = HydratedDocument<InferSchemaType<typeof MembershipSchema>>;

const Membership: Model<IMembership> = mongoose.model<IMembership>('Membership', MembershipSchema);

export default Membership;
