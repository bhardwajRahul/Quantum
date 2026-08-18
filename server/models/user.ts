import mongoose, { Schema, Model } from 'mongoose';
import validator from 'validator';
import bcrypt from 'bcryptjs';
import { IUser } from '@typings/models/user';
import PortBinding from '@models/portBinding';
import Repository from '@models/repository';
import Github from '@models/github';
import DockerContainer from '@models/docker/container';
import DockerImage from '@models/docker/image';
import DockerNetwork from '@models/docker/network';
import logger from '@utilities/logger';

const UserSchema: Schema<IUser> = new Schema({
    username: {
        type: String,
        minlength: [8, 'User::Username::MinLength'],
        maxlength: [16, 'User::Username::MaxLength'],
        required: [true, 'User::Username::Required'],
        unique: true,
        lowercase: true,
        trim: true
    },
    portBindings: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: 'PortBinding'
    }],
    containers: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: 'DockerContainer'
    }],
    networks: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: 'DockerNetwork'
    }],
    images: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: 'DockerImage'
    }],
    container: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'DockerContainer'
    },
    repositories: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Repository'
    }],
    deployments: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Deployment'
    }],
    github: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Github'
    },
    defaultOrganization: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Organization'
    },
    fullname: {
        type: String,
        minlength: [8, 'User::Fullname::MinLength'],
        maxlength: [32, 'User::Fullname::MaxLength'],
        required: [true, 'User::Fullname::Required'],
        trim: true
    },
    email: {
        type: String,
        required: [true, 'User::Email::Required'],
        unique: true,
        lowercase: true,
        trim: true,
        validate: [validator.isEmail, 'User::Email::Validate']
    },
    password: {
        type: String,
        required: [true, 'User::Password::Required'],
        minlength: [8, 'User::Password::MinLength'],
        maxlength: [16, 'User::Password::MaxLength'],
        select: false
    },
    passwordConfirm: {
        type: String,
        required: [true, 'User::PasswordConfirm::Required'],
        validate: {
            validator:function(v:string):boolean{
                return v === this.password;
            },
            message: 'User::PasswordConfirm::Validate'
        }
    },
    role: {
        type: String,
        lowercase: true,
        enum: ['user', 'admin'],
        default: 'user'
    },
    passwordChangedAt: Date,
    passwordResetToken: String,
    passwordResetExpires: Date,
    createdAt: {
        type: Date,
        default: Date.now
    }
});

UserSchema.index({ username: 'text', fullname: 'text', email: 'text' });

const cascadeDeleteHandler = async (document: IUser): Promise<void> => {
    if(!document) return;
    const query = { user: document._id };

    await Repository.deleteMany(query);
    await Github.findOneAndDelete(query);
    await DockerContainer.findOneAndDelete({ _id: document.container });
    await PortBinding.deleteMany(query);
    try{
        await DockerContainer.deleteMany(query);
        await DockerNetwork.deleteMany(query);
        await DockerImage.deleteMany(query);
    }catch(e){
        logger.error('@models/user.ts (cascadeDeleteHandler): ' + e);
    }
};

UserSchema.pre('findOneAndDelete', async function (){
    const conditions = this.getQuery();
    const user = await this.model.findOne(conditions).populate('container');
    if(user){
        await cascadeDeleteHandler(user);
    }
});

UserSchema.pre('deleteMany', async function() {
    const conditions = this.getQuery();
    const users = await this.find(conditions);
    await Promise.all(users.map(async (user) => {
        await cascadeDeleteHandler(user);
    }));
});

const removeWhitespace = (str: string): string => {
    return str.replace(/\s/g, '');
}

const hashPassword = async (password: string): Promise<string> => {
    const saltRounds = 12;
    return await bcrypt.hash(password, saltRounds);
}

UserSchema.pre('save', async function(next){
    try{

        if(!this.isModified('password')) return next();
        this.username = removeWhitespace(this.username);
        this.password = await hashPassword(this.password);
        this.passwordConfirm = undefined;

        if(this.isModified('password') && !this.isNew){
            this.passwordChangedAt = new Date();
        }
        next();
    }catch(error: any){
        next(error);
    }
});

UserSchema.methods.isCorrectPassword = async function(candidatePassword: string, userPassword: string): Promise<boolean> {
    return await bcrypt.compare(candidatePassword, userPassword);
};

UserSchema.methods.isPasswordChangedAfterJWFWasIssued = function(JWTTimeStamp: number): boolean {
    if(this.passwordChangedAt){
        const changedTimeStamp = Math.floor(this.passwordChangedAt.getTime() / 1000);
        return JWTTimeStamp < changedTimeStamp;
    }
    return false;
};

const User: Model<IUser> = mongoose.model('User', UserSchema);

export default User;
