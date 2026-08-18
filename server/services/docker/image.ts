import logger from '@utilities/logger';
import mongoose from 'mongoose';
import DockerImageModel from '@models/docker/image';
import { getDockerHost } from '@services/docker/host';
import { IDockerImage } from '@typings/models/docker/image';

const docker = getDockerHost().client();

export const isImageAvailable = async (imageName: string, tag: string = 'latest'): Promise<boolean> => {
    const fullImageName = `${imageName}:${tag}`;
    try{
        const images = await docker.listImages({ filters: { reference: [fullImageName] } });
        return images.some((image) => image.RepoTags?.includes(fullImageName));
    }catch(error: any){
        logger.error('@services/docker/image.ts (isImageAvailable): ' + error);
        throw error;
    }
}

export const pullImage = async (imageName: string, tag: string = 'latest'): Promise<void> => {
    const fullImageName = `${imageName}:${tag}`;
    try{
        const isAvailable = await isImageAvailable(imageName, tag);
        if(isAvailable) return;

        logger.info(`@services/docker/image.ts (pullImage): Pulling "${fullImageName}"...`);
        const stream = await docker.pull(fullImageName);
        await new Promise<void>((resolve, reject) => {
            docker.modem.followProgress(stream, (err: any) => (err ? reject(err) : resolve()));
        });
        logger.info(`@services/docker/image.ts (pullImage): Image "${fullImageName}" downloaded.`);
    }catch(error: any){
        logger.error('@services/docker/image.ts (pullImage): ' + error);
        throw error;
    }
}

export const materializeImage = async (doc: IDockerImage): Promise<void> => {
    await pullImage(doc.name, doc.tag);
    await mongoose.model('User').updateOne({ _id: doc.user }, { $push: { images: doc._id } });
};

export const createAndMaterializeImage = async (attrs: Record<string, any>) => {
    const image = await DockerImageModel.create(attrs);
    await materializeImage(image as unknown as IDockerImage);
    return image;
};