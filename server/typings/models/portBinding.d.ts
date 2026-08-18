import mongoose from 'mongoose';
import { IDockerContainer } from './docker/container';

export interface IPortBinding{
    internalPort: number,
    protocol: 'tcp' | 'udp';
    _id: mongoose.Schema.Types.ObjectId,
    externalPort?: number;
    user: mongoose.Schema.Types.ObjectId,
    organization: mongoose.Types.ObjectId,
    container: mongoose.Schema.Types.ObjectId | IDockerContainer
}