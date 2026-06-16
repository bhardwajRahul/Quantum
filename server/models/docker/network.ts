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
        // sparse: the subnet is assigned by materializeNetwork (service layer) AFTER
        // the pure save, so a freshly-created doc has no subnet yet. sparse lets
        // multiple docs sit at null without tripping the unique index.
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
        // By default it is bridge and, from the frontend, you cannot choose what 
        // type of network. This is because the overlay is with docker swarm. And, 
        // Quantum still does not allow connections between multiple servers. Still.
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
    // TODO: Allow a container to function without having an assigned network.
    await mongoose.model('DockerContainer').deleteMany({ network: document._id });
    await mongoose.model('User').updateOne({ _id: document.user }, { $pull: { networks: document._id } });
    // ADR-0001: the Docker daemon teardown CODE lives in the service layer
    // (teardownNetwork); the hook only delegates. DB ref-cascade stays here.
    await teardownNetwork(document);
};

DockerNetworkSchema.pre('save', async function(next){
    try{
        if(this.isNew){
            const userId = (this.user as IUser)._id.toString();
            this.dockerNetworkName = getSystemNetworkName(userId, this._id.toString());
            // NOTE (ADR-0001): the real Docker network + User back-ref are NOT
            // created here. Persistence is pure. The subnet is allocated by
            // materializeNetwork (@services/docker/network) right after `.create()`,
            // because picking a non-overlapping range requires reading the live
            // Docker network list (I/O that must not live in a model hook).
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