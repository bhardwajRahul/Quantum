import mongoose, { InferSchemaType, HydratedDocument, Model, Schema } from 'mongoose';

export const CodespaceSchema = new Schema({
    organization: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Organization',
        required: [true, 'Codespace::Organization::Required'],
        index: true
    },
    project: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Project',
        required: [true, 'Codespace::Project::Required']
    },
    user: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: [true, 'Codespace::User::Required']
    },
    name: {
        type: String,
        required: [true, 'Codespace::Name::Required'],
        trim: true
    },
    image: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'DockerImage'
    },
    network: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'DockerNetwork'
    },
    container: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'DockerContainer'
    },
    portBinding: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'PortBinding'
    },
    cpuCores: {
        type: Number,
        default: 1
    },
    memoryMb: {
        type: Number,
        default: 2048
    },
    diskGb: {
        type: Number,
        default: 10
    },
    status: {
        type: String,
        enum: ['pending', 'provisioning', 'running', 'stopped', 'error'],
        default: 'pending',
        index: true
    },
    accessUrl: {
        type: String
    },

    passwordEnc: {
        type: String,
        select: false
    },
    nodeId: {
        type: String,
        default: 'local'
    },
    createdAt: {
        type: Date,
        default: Date.now
    }
});

CodespaceSchema.index({ organization: 1, name: 1 }, { unique: true });

export type ICodespace = HydratedDocument<InferSchemaType<typeof CodespaceSchema>>;

const cascadeDeleteHandler = async (document: ICodespace): Promise<void> => {
    if(!document || !document.container) return;
    await mongoose.model('DockerContainer').findOneAndDelete({ _id: document.container });
};

CodespaceSchema.pre('findOneAndDelete', async function(){
    const codespace = await this.model.findOne(this.getQuery());
    await cascadeDeleteHandler(codespace as ICodespace);
});

CodespaceSchema.pre('deleteMany', async function(){
    const conditions = this.getQuery();
    const codespaces = await mongoose.model('Codespace').find(conditions);
    await Promise.all(codespaces.map(async (codespace) => {
        await cascadeDeleteHandler(codespace as ICodespace);
    }));
});

const Codespace: Model<ICodespace> = mongoose.model<ICodespace>('Codespace', CodespaceSchema);

export default Codespace;
