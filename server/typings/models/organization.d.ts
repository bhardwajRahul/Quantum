import mongoose, { Document } from 'mongoose';

export interface IOrganization extends Document {
    _id: mongoose.Types.ObjectId;
    name: string;
    slug: string;
    owner: mongoose.Types.ObjectId;
    isPersonal: boolean;
    createdAt: Date;
}
