import mongoose, { Document } from 'mongoose';
import { IUser } from './user';
import { IDeployment } from './deployment';
import { IDockerContainer } from './docker/container';

export interface IRepository extends Document{
    alias: string;
    _id: string | mongoose.Types.ObjectId;
    name: string;
    owner: string;
    branch: string;
    webhookId?: number;
    buildCommand?: string;
    installCommand?: string;
    startCommand?: string;
    rootDirectory?: string;
    framework?: string;
    runtime?: string;
    runtimeVersion?: string;
    outputDirectory?: string;
    buildStrategy?: 'auto' | 'dockerfile' | 'prebuilt-image' | 'exec';
    dockerfilePath?: string;
    image?: string;
    sourceType?: 'github';
    organization?: mongoose.Types.ObjectId;
    project?: mongoose.Types.ObjectId;
    environment?: mongoose.Types.ObjectId;
    container: mongoose.Schema.Types.ObjectId | IDockerContainer;
    user: mongoose.Schema.Types.ObjectId | IUser;
    url: string;
    activeDeployment?: IDeployment,
    deployments: mongoose.Types.ObjectId[],
    port?: number;
    createdAt: Date;
}