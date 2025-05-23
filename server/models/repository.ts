/***
 * Copyright (C) Rodolfo Herrera Hernandez. All rights reserved.
 * Licensed under the MIT license. See LICENSE file in the project root
 * for full license information.
 *
 * =+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+
 *
 * For related information - https://github.com/rodyherrera/Quantum/
 *
 * All your applications, just in one place. 
 *
 * =-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-
****/

import mongoose, { Model, Schema } from 'mongoose';
import { IRepository } from '@typings/models/repository';
import { IUser } from '@typings/models/user';
import { v4 } from 'uuid';
import { IDockerContainer } from '@typings/models/docker/container';
import Github from '@services/github';
import RepositoryHandler from '@services/repositoryHandler';

const RepositorySchema: Schema<IRepository> = new Schema({
    alias: {
        type: String,
        maxlength: [32, 'Repository::Alias::MaxLength'],
        minlength: [4, 'Repository::Alias::MinLength']
    },
    name: {
        type: String,
        required: [true, 'Repository::Name::Required']
    },
    container: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'DockerContainer'
    },
    branch: {
        type: String,
        default: 'main'
    },
    webhookId: String,
    buildCommand: { type: String, default: '' },
    installCommand: { type: String, default: '' },
    startCommand: { type: String, default: '' },
    rootDirectory: { type: String, default: '/' },
    user: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: [true, 'Repository::User::Required'],
    },
    url: {
        type: String,
        required: [true, 'Repository::URL::Required'],
    },
    deployments: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Deployment',
    }],
    port: { type: Number },
    createdAt: { type: Date, default: Date.now },
});

RepositorySchema.index({ alias: 1, user: 1 }, { unique: true });
RepositorySchema.index({ name: 'text', alias: 'text' });

const removeRepositoryReference = async (repository: IRepository) => {
    const { user, _id, deployments } = repository;
    const updatedUser = await mongoose.model('User').findOneAndUpdate(
        { _id: user },
        { $pull: { repositories: _id, deployments: { $in: deployments } } },
        { new: true }
    ).populate('github');
    return updatedUser;
};

const getAndDeleteDeployments = async (repositoryId: mongoose.Types.ObjectId) => {
    const deployments = await mongoose.model('Deployment')
        .find({ repository: repositoryId })
        .select('githubDeploymentId');
    await mongoose.model('Deployment').deleteMany({ repository: repositoryId });
    return deployments;
};

const performCleanupTasks = async (deletedDoc: IRepository, repositoryUser: any, deployments: any[]) => {
    const github = new Github(repositoryUser, deletedDoc);
    await mongoose.model('DockerContainer').findOneAndDelete({ repository: deletedDoc._id });
    await github.deleteWebhook();
    if(!deployments.length) return;
    const currentDeploymentId = deployments[0].githubDeploymentId;
    await github.updateDeploymentStatus(currentDeploymentId, 'inactive');
    await Promise.all(deployments.map(deployment => (
        github.deleteRepositoryDeployment(deployment.githubDeploymentId)
    )));
};

const deleteRepositoryHandler = async (deletedDoc: IRepository) => {
    if(!deletedDoc) return;
    const repositoryUser = await removeRepositoryReference(deletedDoc);
    const deployments = await getAndDeleteDeployments(deletedDoc._id as mongoose.Types.ObjectId);
    await performCleanupTasks(deletedDoc, repositoryUser, deployments);
};

const getRepositoryData = async (_id: mongoose.Types.ObjectId) => {
    return await Repository
        .findById(_id)
        .select('user name deployments')
        .populate({
            path: 'user',
            select: 'username email',
            populate: { path: 'github', select: 'accessToken username' }
        });
};

const createWebhook = async (github: Github, webhookEndpoint: string): Promise<number> => {
    try{
        const webhookId = await github.createWebhook(webhookEndpoint, process.env.SECRET_KEY || '');
        return Number(webhookId);
    }catch(err: any){
        if(err?.response?.data?.message !== 'Repository was archived so is read-only.')
            throw err;
        return 0;
    }
};

const handleUpdateCommands = async (context: any) => {
    const { buildCommand, installCommand, startCommand, rootDirectory } = context._update;
    const { _id } = context._conditions;

    const repositoryData = await getRepositoryData(_id);
    if(!repositoryData) return;

    const { name, deployments, user } = repositoryData;

    if(buildCommand || installCommand || startCommand || rootDirectory){
        const document = { user, name, deployments, buildCommand, installCommand, startCommand, rootDirectory, _id } as IRepository;
        const repositoryHandler = new RepositoryHandler(document);
        const githubHandler = new Github(user as IUser, document);
        repositoryHandler.start(githubHandler);
    }
};

// TODO: refactor with @models/user.ts - createUserContainer
const createRepositoryContainer = async (repository: IRepository): Promise<IDockerContainer> => {
    // TODO: Image SHOULD exists, because the main user container uses it.
    const image = await mongoose.model('DockerImage').findOne({ name: 'alpine', tag: 'latest' });
    const network = await mongoose.model('DockerNetwork').create({
        user: repository.user,
        driver: 'bridge',
        name: repository.alias
    });
    const container = await mongoose.model('DockerContainer').create({
        name: repository.alias,
        user: repository.user,
        repository: repository._id,
        image: image._id,
        network: network._id,
        command: '/bin/sh',
        isRepositoryContainer: true
    });
    return container;
};

RepositorySchema.methods.updateAliasIfNeeded = async function(){
    const existingRepository = await mongoose.model('Repository')
        .findOne({ alias: this.alias, user: this.user });
    if(existingRepository){
        this.alias = this.alias + '-' + v4().slice(0, 4);
    }
};

RepositorySchema.methods.getUserWithGithubData = async function(){
    const data = await mongoose.model('User')
        .findById(this.user)
        .populate('github');
    return data;
};

RepositorySchema.methods.updateUserAndRepository = async function(deployment: any){
    const updateUser = {
        $push: { repositories: this._id, deployments: deployment._id }
    };
    // findByIdAndUpdate?????
    await mongoose.model('User').findByIdAndUpdate(this.user, updateUser);
    this.deployments.push(deployment._id);
};

RepositorySchema.pre('save', async function(next){
    try{
        if(!this.alias) this.alias = this.name;
        await this.updateAliasIfNeeded();

        if(this.isNew){
            this.container = await createRepositoryContainer(this);
            const repositoryUser = await this.getUserWithGithubData();
            const github = new Github(repositoryUser, this);
            const deployment = await github.deployRepository();
            const webhookEndpoint = `${process.env.DOMAIN}/api/v1/webhook/${this._id}/`;
            this.webhookId = await createWebhook(github, webhookEndpoint);
            await this.updateUserAndRepository(deployment);
        }
        next();
    }catch(error: any){
        return next(error);
    }
});

RepositorySchema.pre('deleteMany', async function() {
    const conditions = this.getQuery();
    const repositories = await mongoose.model('Repository').find(conditions);
    await Promise.all(repositories.map(async (repository) => {
        await deleteRepositoryHandler(repository);
    }));
});

RepositorySchema.post('findOneAndDelete', async function(deletedDoc: IRepository){
    await deleteRepositoryHandler(deletedDoc);
});

RepositorySchema.pre('deleteMany', async function(){
    const conditions = this.getQuery();
    const repositories = await this.model.find(conditions);
    await Promise.all(repositories.map(async (deletedDoc) => {
        await deleteRepositoryHandler(deletedDoc);
    }));
});

RepositorySchema.pre('findOneAndUpdate', async function(next){
    try{
        await handleUpdateCommands(this);
        next();
    }catch(error: any){
        next(error);
    }
});

const Repository: Model<IRepository> = mongoose.model('Repository', RepositorySchema);

export default Repository;
