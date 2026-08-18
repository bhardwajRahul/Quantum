import DockerContainer from '@models/docker/container';
import RuntimeError from '@utilities/runtimeError';
import DockerImage from '@models/docker/image';
import DockerNetwork from '@models/docker/network';
import HandlerFactory from '@controllers/common/handlerFactory';
import DockerContainerService, { materializeContainer } from '@services/docker/container';
import mongoose from 'mongoose';
import { IDockerImage } from '@typings/models/docker/image';
import { IDockerNetwork } from '@typings/models/docker/network';
import { IDockerContainer } from '@typings/models/docker/container';
import { IRequestDockerImage } from '@typings/controllers/docker/container';
import { isImageAvailable, createAndMaterializeImage } from '@services/docker/image';
import { createAndMaterializeNetwork } from '@services/docker/network';
import { catchAsync, findRandomAvailablePort } from '@utilities/helpers';
import { NextFunction, Request, Response } from 'express';
import { IUser } from '@typings/models/user';
import { IRequest } from '@typings/controllers/common';
import { parseConfigAndDeploy } from '@services/oneClickDeploy';
import { ensureOrgDefaults } from '@services/tenancy/provisioning';
import { enqueueReload } from '@services/orchestrator';
import logger from '@utilities/logger';
import sendEmail from '@services/sendEmail';

const DockerContainerFactory = new HandlerFactory({
    model: DockerContainer,
    scope: { field: 'organization' },
    fields: [
        'volumes',
        'user',
        'image',
        'portBindings',
        'status',
        'command',
        'network',
        'environment',
        'isRepositoryContainer',
        'name'
    ]
});

export const deleteDockerContainer = DockerContainerFactory.deleteOne({
    middlewares: {
        pre: [async (): Promise<any> => {
            return { isUserContainer: false };
        }]
    }
});

export const getMyDockerContainers = DockerContainerFactory.getAll({
    middlewares: {
        pre: [(req: IRequest, query: any) => {

            query.organization = req.tenant?.org?._id;
            return query;
        }]
    }
});

export const updateDockerContainer = DockerContainerFactory.updateOne({
    middlewares: {
        post: [async (req: IRequest, data: any) => {
            const changed = req.body && (('environment' in req.body) || ('command' in req.body));
            const containerId = data?._id?.toString();
            if(changed && containerId){
                enqueueReload(containerId, { userId: (req.user as any)?._id?.toString() }).catch((error) =>
                    logger.warn('@controllers/docker/container.ts (updateDockerContainer): reload enqueue failed: ' + error));
            }
            return data;
        }]
    }
});

export const countUserContainersByStatus = catchAsync(async (req: IRequest, res: Response, next: NextFunction) => {

    const orgId = req.tenant?.org?._id;
    if(!orgId){
        return next(new RuntimeError('DockerContainer::Organization::Required', 400));
    }
    const result = await DockerContainer.aggregate([
        {
            $match: {
                organization: new mongoose.Types.ObjectId(orgId.toString())
            }
        },
        {
            $group: {
                _id: '$status',
                count: { $sum: 1 }
            }
        },
        {
            $match: {
                _id: { $in: ['running', 'stopped', 'restarting'] }
            }
        }
    ]);
    const counts = { running: 0, restarting: 0, stopped: 0 };
    result.forEach((item) => counts[item._id] = item.count);
    res.status(200).json({
        status: 'success',
        data: counts
    });
});

const findOrCreateImage = async (
    image: string | IRequestDockerImage,
    userId: string,
    organizationId: string,
    next: NextFunction
): Promise<IDockerImage | null> => {
    let containerImage = null;
    if(mongoose.isValidObjectId(image)){
        containerImage = await DockerImage.findById(image).select('_id');
    }
    if(!containerImage){
        const { name, tag } = image as IRequestDockerImage;
        if(!(await isImageAvailable(name, tag))){
            next(new RuntimeError('DockerContainer::CreateDocker::ImageNotFound', 404));
            return null;
        }
        containerImage = await createAndMaterializeImage({ name, tag, user: userId, organization: organizationId });
    }
    return containerImage;
};

const findOrCreateNetwork = async (
    network: string,
    userId: string,
    organizationId: string,
): Promise<IDockerNetwork | null> => {
    let containerNetwork = null;
    if(mongoose.isValidObjectId(network)){
        containerNetwork = await DockerNetwork.findById(network).select('_id');
    }
    if(!containerNetwork){
        containerNetwork = await createAndMaterializeNetwork({
            user: userId,
            organization: organizationId,
            driver: 'bridge',
            name: network
        });
    }
    return containerNetwork;
};

export const randomAvailablePort = catchAsync(async (req: Request, res: Response, next: NextFunction) => {
    const port = await findRandomAvailablePort();
    if(port === -1){

        return next(new RuntimeError('DockerContainer::RandomAvailablePort::ManyFailedAttempts', 500));
    }
    res.status(200).json({ status: 'success', data: port });
});

export const oneClickDeploy = catchAsync(async (req: Request, res: Response, next: NextFunction) => {
    const { config } = req.body;
    if(!config){
        return next(new RuntimeError('Docker::Container::OneClickDeploy::MissingConfig', 400));
    }
    const tenant = (req as IRequest).tenant;
    const orgId = tenant?.org?._id;
    if(!orgId){
        return next(new RuntimeError('Docker::Container::OneClickDeploy::Organization::Required', 400));
    }
    const { project } = await ensureOrgDefaults(orgId);
    const scope = { organization: orgId, project: tenant?.project?._id || project._id };
    const container = await parseConfigAndDeploy(req.user as IUser, config, scope);
    res.status(200).json({ status: 'success', data: container });
});

export const createDockerContainer = catchAsync(async (req: Request, res: Response, next: NextFunction) => {
    const { image, name, network, command } = req.body;
    if(!image || !name){
        return next(new RuntimeError('DockerContainer::CreateDocker::MissingParams', 400));
    }
    const user = req.user as IUser;
    const userId = user._id.toString();

    const orgRef = (req as IRequest).tenant?.org?._id;
    if(!orgRef){
        return next(new RuntimeError('DockerContainer::Organization::Required', 400));
    }
    const organizationId = orgRef.toString();

    const containerImage = await findOrCreateImage(image, userId, organizationId, next);
    const containerNetwork = await findOrCreateNetwork(network, userId, organizationId);
    if(!containerNetwork || !containerImage){
        return next(new RuntimeError('DockerContainer::CreateDocker::ImageOrNetworkError', 500));
    }

    const container = await DockerContainer.create({
        name,
        user: userId,
        organization: organizationId,
        command,
        image: containerImage._id,
        network: containerNetwork._id
    });
    await materializeContainer(container as unknown as IDockerContainer);

    sendEmail({
        to: user.email,
        subject: `"${container.name}" (${containerImage.name}:${containerImage.tag}) created successfully.`,
        html: `Hello ${user.username}!, you have created the container "${container.name}" correctly. Currently, it should be deploying. The image used is "${containerImage.name}:${containerImage.tag}" and the network created for the container is "${containerNetwork.name}".`
    });

    res.status(200).json({ status: 'success', data: container });
});

export const containerStatus = catchAsync(async (req: Request, res: Response, next: NextFunction) => {
    const { status } = req.body;
    const VALID_STATUS = ['stop', 'restart', 'start'];

    if(!VALID_STATUS.includes(status)){
        return next(new RuntimeError('DockerContainer::Status::Invalid', 400));
    }

    const containerId = req.params.id;
    const container = await DockerContainer.findById(containerId);

    if(!container){
        return next(new RuntimeError('DockerContainer::Status::NotFound', 400));
    }

    const containerService = new DockerContainerService(container);
    const statusMap: Record<string, () => Promise<void>> = {
        async stop(){
            await containerService.stop();
            sendEmail({
                to: req.user.email,
                subject: `Container "${container.name}" shut down successfully.`,
                html: `Hi @${req.user.username}, the container has been shut down successfully.`
            });
        },
        async restart(){
            await containerService.restart();
            sendEmail({
                to: req.user.email,
                subject: `You have successfully restarted "${container.name}"`,
                html: `Hello @${req.user.username}, the container is currently restarting, the services will be redeployed and the installation, construction and execution commands will be executed.`
            });
        },
        async start(){
            await containerService.start();
            sendEmail({
                to: req.user.email,
                subject: `Starting and deploying "${container.name}"`,
                html: `Hi @${req.user.username}, your container is deploying...`
            });
        }
    };
    await statusMap[status]();

    res.status(200).json({
        status: 'success',
        data: container
    });
});