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

const mongoose = require('mongoose');
const TextSearch = require('mongoose-partial-search');
const Github = require('@services/github');
const RepositoryHandler = require('@services/repositoryHandler');
const nginxHandler = require('@services/nginxHandler');
const { getPublicIPAddress } = require('@utilities/runtime');
const { v4 } = require('uuid');

const RepositorySchema = new mongoose.Schema({
    alias: {
        type: String,
        maxlength: [32, 'Repository::Alias::MaxLength'],
        minlength: [4, 'Repository::Alias::MinLength']
    },
    name: {
        type: String,
        required: [true, 'Repository::Name::Required']
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
    domains: [{
        type: String,
        trim: true
    }],
    port: { type: Number },
    createdAt: { type: Date, default: Date.now, },
});

RepositorySchema.plugin(TextSearch);
RepositorySchema.index({ alias: 1, user: 1 }, { unique: true });
RepositorySchema.index({ name: 'text', alias: 'text' });

const removeRepositoryReference = async (repository) => {
    const { user, _id, deployments } = repository;
    const updatedUser = await mongoose.model('User').findOneAndUpdate(
        { _id: user },
        { $pull: { repositories: _id, deployments: { $in: deployments } } },
        { new: true }
    ).populate('github');
    return updatedUser;
};

const getAndDeleteDeployments = async (repositoryId) => {
    const deployments = await mongoose.model('Deployment')
        .find({ repository: repositoryId })
        .select('githubDeploymentId');
    await mongoose.model('Deployment').deleteMany({ repository: repositoryId });
    return deployments;
};

const performCleanupTasks = async (deletedDoc, repositoryUser, deployments) => {
    const github = new Github(repositoryUser, deletedDoc);
    const repositoryHandler = new RepositoryHandler(deletedDoc, repositoryUser);
    repositoryHandler.removeFromRuntime();
    // Use Github utility for cleanup
    await Promise.all([
        await Github.deleteLogAndDirectory(
            `/var/lib/quantum/${process.env.NODE_ENV}/containers/${repositoryUser._id}/logs/${deletedDoc._id}.log`,
            `/var/lib/quantum/${process.env.NODE_ENV}/containers/${repositoryUser._id}/github-repos/${deletedDoc._id}/`
        ),
        github.deleteWebhook()
    ]);
    // The current deployment should be at index 0, and it 
    // cannot be deleted until it has changed its status to 
    // inactive. Well, Github prevents deleting an active deployment.
    const currentDeploymentId = deployments[0].githubDeploymentId;
    await github.updateDeploymentStatus(currentDeploymentId, 'inactive');
    // Now, that the current deployment is in an inactive 
    // state, it is possible to delete it, along with all the 
    // deployments that existed for the repository within our platform.
    await Promise.all(deployments.map(deployment => (
        github.deleteRepositoryDeployment(deployment.githubDeploymentId)
    )));
};

const deleteRepositoryHandler = async (deletedDoc) => {
    // Remove repository reference from user's repositories array
    const repositoryUser = await removeRepositoryReference(deletedDoc);
    // Retrieve and delete deployments associated with the repository
    const deployments = await getAndDeleteDeployments(deletedDoc._id);
    // Remove repository domains
    await nginxHandler.removeDomainList(deletedDoc.domains);
    // Perfom cleanup task using PTYhandler and Github utility
    await performCleanupTasks(deletedDoc, repositoryUser, deployments);
};

const handleDomains = async (domains, port, currentDomains, userEmail) => {
    const domainsToAdd = domains.filter((domain) => !currentDomains.includes(domain));
    const domainsToRemove = currentDomains.filter((domain) => !domains.includes(domain));
    // TODO: STORE IT IN GLOBAL SCOPE 
    const ipv4 = await getPublicIPAddress();

    await Promise.all(domainsToAdd.map(async (domain) => {
        const trimmedDomain = domain.trim();
        try{
            await nginxHandler.addDomain({ domain: trimmedDomain, port, ipv4 });
            await nginxHandler.generateSSLCert(trimmedDomain, userEmail);
            await nginxHandler.updateDomain({ domain: trimmedDomain, port, ipv4, useSSL: true });
        }catch(error){
            console.error(`[Quantum Cloud]: Error processing domain (add) '${trimmedDomain}':`, error);
        }
    }));

    await nginxHandler.removeDomainList(domainsToRemove);
};

const getRepositoryData = async (_id) => {
    return await Repository
        .findById(_id)
        .select('user name deployments domains')
        .populate({
            path: 'user',
            select: 'username email',
            populate: { path: 'github', select: 'accessToken username' }
        });
};

const createWebhook = async (github, webhookEndpoint) => {
    try{
        const webhookId = await github.createWebhook(webhookEndpoint, process.env.SECRET_KEY);
        return webhookId;
    }catch(err){
        if(err?.response?.data?.message !== 'Repository was archived so is read-only.')
            throw err;
        return undefined;
    }
};

const handleUpdateCommands = async (context) => {
    const { buildCommand, installCommand, startCommand, rootDirectory, domains, port } = context._update;
    const { _id } = context._conditions;

    const repositoryData = await getRepositoryData(_id);
    if(!repositoryData) return;

    const { user, name, deployments } = repositoryData;

    if(buildCommand || installCommand || startCommand || rootDirectory){
        const document = { user, name, deployments, buildCommand, installCommand, startCommand, rootDirectory, _id };
        const repositoryHandler = new RepositoryHandler(document, user);
        const githubHandler = new Github(user, document);
        repositoryHandler.start(githubHandler);
    }
    
    if(domains?.length) await handleDomains(domains, port, repositoryData.domains, repositoryData.user.email);
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

RepositorySchema.methods.updateUserAndRepository = async function(deployment){
    const updateUser = {
        $push: { repositories: this._id, deployments: deployment._id }
    };
    await mongoose.model('User').findByIdAndUpdate(this.user, updateUser);
    this.deployments.push(deployment._id);
};

RepositorySchema.pre('save', async function(next){
    try{
        if(!this.alias) this.alias = this.name;
        await this.updateAliasIfNeeded();

        if(this.isNew){
            const repositoryUser = await this.getUserWithGithubData();
            const github = new Github(repositoryUser, this);
            const deployment = await github.deployRepository();
            const webhookEndpoint = `${process.env.DOMAIN}/api/v1/webhook/${this._id}/`;
            this.webhookId = await createWebhook(github, webhookEndpoint);
            await this.updateUserAndRepository(deployment);
        }
        next();
    }catch(error){
        return next(error);
    }
});

RepositorySchema.post('findOneAndDelete', async function(deletedDoc){
    await deleteRepositoryHandler(deletedDoc);
});

RepositorySchema.pre('deleteMany', async function(){
    const repositories = await this.model.find(this._conditions);
    await Promise.all(repositories.map(async (deletedDoc) => {
        await deleteRepositoryHandler(deletedDoc);
    }));
});
  
RepositorySchema.pre('findOneAndUpdate', async function(next){
    try{
        await handleUpdateCommands(this);
        next();
    }catch (error){
        next(error);
    }
});

const Repository = mongoose.model('Repository', RepositorySchema);

module.exports = Repository;