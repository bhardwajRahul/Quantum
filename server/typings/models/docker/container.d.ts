import mongoose, { Document } from 'mongoose';

export type ContainerStatus = 'created' | 'running' | 'stopped' | 'reloading' | 'restarting' | 'building' | 'error';

export interface IDockerContainerEnvironment{
    isEncrypted: boolean;
    variables: Map<string, string>;
}

export interface IDockerContainerPortBindings{
    internalPort: number;
    externalPort: number;
    protocol: 'tcp' | 'udp';
}

export interface IDockerContainerVolume{
    containerPath: string;
    mode: 'rw' | 'ro';
}

export interface FileInfo{
    name: string;
    isDirectory: boolean;
}

export interface ExecResult{
    output: string;
    exitCode: number;
    error?: string;
}

export interface IDockerContainer extends Document{
    _id: mongoose.Schema.Types.ObjectId,
    user: mongoose.Schema.Types.ObjectId,
    organization: mongoose.Types.ObjectId,
    repository: mongoose.Schema.Types.ObjectId,
    isRepositoryContainer: boolean;
    portBindings: IDockerContainerPortBindings[];
    network: mongoose.Schema.Types.ObjectId,
    image: mongoose.Schema.Types.ObjectId,
    dockerContainerName: string;
    ipAddress?: string;
    command: string;
    volumes: IDockerContainerVolume[];
    storagePath: string,
    isUserContainer: boolean;
    environment: IDockerContainerEnvironment;
    status: ContainerStatus,
    desiredState: 'running' | 'stopped',
    startedAt?: Date,
    stoppedAt?: Date,
    name: string,
    createdAt: Date,
    updatedAt: Date
}