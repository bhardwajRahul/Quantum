import mongoose from 'mongoose';
import { IGithub } from '@typings/models/github';
import { encrypt, decrypt } from '@utilities/encryption';

const GithubSchema = new mongoose.Schema<IGithub>({
    user: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
    },
    githubId: {
        type: String,
        required: [true, 'Github::GithubId::Required']
    },
    accessToken: {
        type: String,
        required: [true, 'Github::AccessToken::Required']
    },
    username: {
        type: String,
        required: [true, 'Github::Username::Required']
    },
    avatarUrl: {
        type: String
    }
});

GithubSchema.index({ username: 'text' });

const cascadeDeleteHandler = async (document: IGithub): Promise<void> => {
    if(!document) return;
    await mongoose.model('User').findByIdAndUpdate(document.user, { $unset: { github: 1 } });
};

GithubSchema.methods.getDecryptedAccessToken = function(){
    return decrypt(this.accessToken);
};

GithubSchema.pre('save', async function(next){
    if(this.isModified('accessToken')){
        try{
            this.accessToken = encrypt(this.accessToken) as string;
        }catch(e){
            return next(e as Error);
        }
    }
    next();
});

GithubSchema.post('save', async function(this: IGithub){
    const { user, _id } = this;
    await mongoose.model('User').findByIdAndUpdate(user, { github: _id });
});

GithubSchema.post('findOneAndDelete', async function (this: IGithub){
    await cascadeDeleteHandler(this);
});

GithubSchema.pre('deleteMany', async function(){
    const conditions = this.getQuery();
    const githubAccounts = await mongoose.model('Github').find(conditions);
    await Promise.all(githubAccounts.map(async (githubAccount) => {
        await cascadeDeleteHandler(githubAccount);
    }));
});

const Github = mongoose.model<IGithub>('Github', GithubSchema);

export default Github;
