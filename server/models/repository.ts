import mongoose, { Model, Schema } from 'mongoose';
import { IRepository } from '@typings/models/repository';
import { v4 } from 'uuid';
import { teardownRepositoryGithub } from '@services/github';

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
    owner: {
        type: String
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
    framework: String,
    runtime: String,
    runtimeVersion: String,
    outputDirectory: String,

    buildStrategy: {
        type: String,
        enum: ['auto', 'dockerfile', 'prebuilt-image', 'exec'],
        default: 'exec'
    },

    dockerfilePath: String,

    image: String,
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

    organization: { type: mongoose.Schema.Types.ObjectId, ref: 'Organization' },
    project: { type: mongoose.Schema.Types.ObjectId, ref: 'Project', required: [true, 'Repository::Project::Required'] },
    environment: { type: mongoose.Schema.Types.ObjectId, ref: 'Environment' },

    sourceType: { type: String, enum: ['github'], default: 'github' },
    createdAt: { type: Date, default: Date.now },
});

RepositorySchema.index({ alias: 1, organization: 1 }, { unique: true });
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

    await mongoose.model('DockerContainer').findOneAndDelete({ repository: deletedDoc._id });

    await teardownRepositoryGithub(deletedDoc, repositoryUser, deployments);
};

const deleteRepositoryHandler = async (deletedDoc: IRepository) => {
    if(!deletedDoc) return;
    const repositoryUser = await removeRepositoryReference(deletedDoc);
    const deployments = await getAndDeleteDeployments(deletedDoc._id as mongoose.Types.ObjectId);
    await performCleanupTasks(deletedDoc, repositoryUser, deployments);
};

RepositorySchema.pre('save', async function(next){
    try{
        if(!this.alias) this.alias = this.name;
        const existingRepository = await mongoose.model('Repository')
            .findOne({ alias: this.alias, user: this.user });
        if(existingRepository){
            this.alias = this.alias + '-' + v4().slice(0, 4);
        }
        if(this.isNew){

            await mongoose.model('User').findByIdAndUpdate(this.user, { $push: { repositories: this._id } });
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

const Repository: Model<IRepository> = mongoose.model('Repository', RepositorySchema);

export default Repository;
