import mongoose, { Model, Schema } from 'mongoose';
import { IDatabase, IDatabaseCredentials } from '@typings/models/database';
import { decrypt } from '@utilities/encryption';
import logger from '@utilities/logger';

const DatabaseSchema: Schema<IDatabase> = new Schema({
    name: {
        type: String,
        required: [true, 'Database::Name::Required'],
        trim: true
    },
    engine: {
        type: String,
        enum: ['postgres', 'mysql', 'mariadb', 'mongodb', 'redis'],
        required: [true, 'Database::Engine::Required']
    },

    version: {
        type: String
    },
    organization: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Organization',
        required: [true, 'Database::Organization::Required'],
        index: true
    },
    project: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Project',
        required: [true, 'Database::Project::Required']
    },
    environment: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Environment'
    },
    user: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
    },
    nodeId: {
        type: String,
        default: 'local',
        index: true
    },
    container: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'DockerContainer'
    },

    credentialsEnc: {
        type: String,
        select: false
    },

    connectionStringEnc: {
        type: String,
        select: false
    },
    status: {
        type: String,
        enum: ['pending', 'provisioning', 'running', 'stopped', 'error', 'backing-up'],
        default: 'pending',
        index: true
    },
    backups: [{
        id: { type: String, required: true },
        path: { type: String, required: true },
        sizeBytes: { type: Number, default: 0 },
        createdAt: { type: Date, default: Date.now }
    }],
    createdAt: {
        type: Date,
        default: Date.now
    }
});

DatabaseSchema.index({ project: 1, name: 1 }, { unique: true });
DatabaseSchema.index({ project: 1 });

DatabaseSchema.methods.getDecryptedCredentials = function(this: IDatabase): IDatabaseCredentials | null {
    if(!this.credentialsEnc) return null;
    try{
        return JSON.parse(decrypt(this.credentialsEnc)) as IDatabaseCredentials;
    }catch(error){
        logger.error('@models/database.ts (getDecryptedCredentials): ' + error);
        return null;
    }
};

DatabaseSchema.methods.getConnectionString = function(this: IDatabase): string | null {
    if(!this.connectionStringEnc) return null;
    try{
        return decrypt(this.connectionStringEnc);
    }catch(error){
        logger.error('@models/database.ts (getConnectionString): ' + error);
        return null;
    }
};

const Database: Model<IDatabase> = mongoose.model<IDatabase>('Database', DatabaseSchema);

export default Database;
