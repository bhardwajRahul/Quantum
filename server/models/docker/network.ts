import mongoose, { Schema, Model } from 'mongoose';
import { IDockerNetwork } from '@typings/models/docker/network';
import { getSystemNetworkName, teardownNetwork } from '@services/docker/network';
import { IUser } from '@typings/models/user';
import RuntimeError from '@utilities/runtimeError';

const DockerNetworkSchema: Schema<IDockerNetwork> = new Schema({
    name: {
        type: String,
        required: [true, 'DockerNetwork::Name::Required'],
        unique: true,
    },
    dockerNetworkName: {
        type: String
    },
    subnet: {
        type: String,
        unique: true,

        sparse: true
    },
    user: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: [true, 'DockerNetwork::User::Required']
    },
    organization: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Organization',
        required: [true, 'DockerNetwork::Organization::Required'],
        index: true
    },
    driver: {
        type: String,

        enum: ['bridge', 'overlay', 'none'],
        default: 'bridge',
        required: [true, 'DockerNetwork::Driver::Required']
    },
    containers: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: 'DockerContainer'
    }]
}, {
    timestamps: true
});

DockerNetworkSchema.index({ organization: 1, name: 1 }, { unique: true });

const cascadeDeleteHandler = async (document: IDockerNetwork): Promise<void> => {
    if(!document) return;

    await mongoose.model('DockerContainer').deleteMany({ network: document._id });
    await mongoose.model('User').updateOne({ _id: document.user }, { $pull: { networks: document._id } });

    await teardownNetwork(document);
};

DockerNetworkSchema.pre('save', async function(next){
    try{
        if(this.isNew){
            const userId = (this.user as IUser)._id.toString();
            this.dockerNetworkName = getSystemNetworkName(userId, this._id.toString());

        }
        next();
    }catch(error: any){
        next(error);
    }
});

const hasActiveMainContainers = async (document: IDockerNetwork): Promise<boolean> => {
    const containers = await mongoose.model('DockerContainer').find({
        network: document._id,
        isUserContainer: true
    });
    const hasActiveMainContainers = containers.length >= 1;
    return hasActiveMainContainers;
};

DockerNetworkSchema.pre('findOneAndDelete', async function(next){
    const network = await this.model.findOne(this.getQuery());
    if(await hasActiveMainContainers(network)){
        next(new RuntimeError('Docker::Network::ActiveUserContainers', 403));
        return;
    }
    next();
});

DockerNetworkSchema.post('findOneAndDelete', async function(doc){
    await cascadeDeleteHandler(doc);
});

DockerNetworkSchema.pre('deleteMany', async function(next){
    const conditions = this.getQuery();
    const networks = await mongoose.model('DockerNetwork').find(conditions);
    await Promise.all(networks.map(async (network) => {
        if(await hasActiveMainContainers(network)){
            next(new RuntimeError('Docker::Network::ActiveUserContainers', 403));
            return;
        }
        await cascadeDeleteHandler(network);
    }));
    next();
});

const DockerNetwork: Model<IDockerNetwork> = mongoose.model('DockerNetwork', DockerNetworkSchema);

export default DockerNetwork;