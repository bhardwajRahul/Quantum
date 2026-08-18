import mongoose from 'mongoose';
import DockerContainer from '@models/docker/container';
import DockerImage from '@models/docker/image';
import DockerNetwork from '@models/docker/network';
import PortBinding from '@models/portBinding';
import Repository from '@models/repository';
import Github from '@services/github';
import { getRuntimeImage } from '@services/runtime/registry';
import { materializeContainer } from '@services/docker/container';
import { createAndMaterializeNetwork } from '@services/docker/network';
import { createAndMaterializeImage } from '@services/docker/image';
import { resolveInternalPort } from '@services/ingress/labels';
import { findRandomAvailablePort } from '@utilities/helpers';
import { IRepository } from '@typings/models/repository';
import { IDockerContainer } from '@typings/models/docker/container';
import logger from '@utilities/logger';

export const populateRepository = (id: string) =>
    Repository.findById(id).populate({
        path: 'user',
        select: 'username email container',
        populate: { path: 'github', select: 'accessToken username' }
    });

const ensureAutoPortBinding = async (
    repository: IRepository,
    container: IDockerContainer,
    userId: any,
    org: any
): Promise<void> => {
    try{
        if(process.env.BASE_DOMAIN) return;
        const already = await PortBinding.findOne({ container: container._id });
        if(already) return;
        const internalPort = resolveInternalPort(repository);
        const externalPort = await findRandomAvailablePort();
        if(externalPort === -1){
            logger.warn('@services/orchestrator/provision.ts (ensureAutoPortBinding): no free host port, app will be unpublished');
            return;
        }
        await PortBinding.create({
            container: container._id,
            user: userId,
            organization: org,
            internalPort,
            externalPort,
            protocol: 'tcp'
        });
        logger.info(`@services/orchestrator/provision.ts (ensureAutoPortBinding): ${repository.alias} ${internalPort} -> host ${externalPort}`);
    }catch(error){
        logger.warn('@services/orchestrator/provision.ts (ensureAutoPortBinding): ' + error);
    }
};

export const ensureRepositoryInfra = async (repository: IRepository): Promise<IDockerContainer> => {
    const existing = await DockerContainer.findOne({ repository: repository._id });
    if(existing) return existing as unknown as IDockerContainer;

    const userId = (repository.user as any)?._id ?? repository.user;
    const { name, tag } = getRuntimeImage(repository.runtime, repository.runtimeVersion);
    const org = (repository as any).organization;
    const image = await DockerImage.findOne({ name, tag, organization: org })
        || await createAndMaterializeImage({ name, tag, user: userId, organization: org });
    const network = await createAndMaterializeNetwork({
        user: userId,
        organization: org,
        driver: 'bridge',
        name: repository.alias
    });
    const container = await DockerContainer.create({
        name: repository.alias,
        user: userId,
        organization: org,
        repository: repository._id,
        image: image._id,
        network: network._id,
        command: '/bin/sh',
        isRepositoryContainer: true
    });

    await ensureAutoPortBinding(repository, container as unknown as IDockerContainer, userId, org);
    await materializeContainer(container as unknown as IDockerContainer);

    await mongoose.model('Repository').updateOne(
        { _id: repository._id },
        { container: container._id }
    );
    return container as unknown as IDockerContainer;
};

export const ensureWebhook = async (repository: IRepository, githubUser: any): Promise<void> => {
    if(repository.webhookId) return;
    try{
        const source = new Github(githubUser, repository);
        const webhookEndpoint = `${process.env.DOMAIN}/api/v1/webhook/${repository._id}/`;
        const webhookId = await source.createWebhook(webhookEndpoint, process.env.SECRET_KEY || '');
        if(webhookId){
            await mongoose.model('Repository').updateOne(
                { _id: repository._id },
                { webhookId: Number(webhookId) || 0 }
            );
        }
    }catch(error: any){
        logger.warn('@services/orchestrator/provision.ts (ensureWebhook): continuing without auto-deploy: ' + (error?.message || error));
    }
};

export default ensureRepositoryInfra;
