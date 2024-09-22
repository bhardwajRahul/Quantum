import mongoose, { Schema, Model } from 'mongoose';
import { IPortBinding } from '@typings/models/portBinding';

const PortBindingSchema: Schema<IPortBinding> = new Schema({
    container: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'DockerContainer'
    },
    internalPort: {
        type: Number,
        required: true,
        min: 1,
        max: 65535
    },
    protocol: {
        type: String,
        enum: ['tcp', 'udp'],
        default: 'tcp'
    },
    externalPort: {
        type: Number,
        unique: true,
        min: 1,
        max: 65535
    }
}, {
    timestamps: true
});

const PortBinding: Model<IPortBinding> = mongoose.model('PortBinding', PortBindingSchema);

export default PortBinding;