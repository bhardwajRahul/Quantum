/***
 * Copyright (C) Rodolfo Herrera Hernandez. All rights reserved.
 * Licensed under the MIT license. See LICENSE file in the project root
 * for full license information.
 *
 * =+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+
 *
 * For related information - https://github.com/rodyherrera/Quantum/
 *
 * All your applications, just in one place.
 *
 * =-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-
****/

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

/**
 * Load a repository with its owner + the owner's GitHub credentials populated —
 * the shape the build/deploy workers need to clone and run. Shared by buildHandler
 * and deployHandler (was duplicated verbatim in both).
 */
export const populateRepository = (id: string) =>
    Repository.findById(id).populate({
        path: 'user',
        select: 'username email container',
        populate: { path: 'github', select: 'accessToken username' }
    });

/**
 * Auto-publish a repository container's app port on a random host port, so a
 * freshly-deployed app is reachable without the user manually adding a port
 * binding. No-op when BASE_DOMAIN is set (Traefik routes by domain instead) or
 * when the repo already has a binding. The internal port is the repo's explicit
 * port or its runtime default (resolveInternalPort). Best-effort: a failure here
 * never blocks the deploy — the app still runs, just unpublished.
 */
const ensureAutoPortBinding = async (
    repository: IRepository,
    container: IDockerContainer,
    userId: any,
    org: any
): Promise<void> => {
    try{
        if(process.env.BASE_DOMAIN) return; // ingress/domain path handles exposure
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

/**
 * Idempotently ensures the infrastructure backing a repository exists: the image
 * doc, the network, the repository container, and (best-effort) the GitHub
 * webhook. This is the relocation of what used to be createRepositoryContainer in
 * models/repository.ts's pre('save') hook — moved out of the model so persistence
 * is pure and the orchestrator owns side effects (ADR-0001).
 *
 * Safe to call repeatedly: it finds existing infra before creating, so a retried
 * deploy job won't duplicate containers/networks.
 */
export const ensureRepositoryInfra = async (repository: IRepository): Promise<IDockerContainer> => {
    const existing = await DockerContainer.findOne({ repository: repository._id });
    if(existing) return existing as unknown as IDockerContainer;

    // deployHandler populates repository.user (full User doc, incl. github token).
    // Pass the _id — never the populated doc — as the ownership ref, or the
    // container's pre('save') would derive its storagePath from the whole object
    // (ENAMETOOLONG + leaks the token into a filesystem path).
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
    // Auto-expose the app on a host port so it is reachable right after deploy.
    // Without this, an exec-strategy app runs but is published nowhere (no port,
    // no domain) and the user has no URL. Created BEFORE materialize so the port
    // is published on the container's first start (no reload needed). Skipped only
    // when ingress will route by domain instead (BASE_DOMAIN configured).
    await ensureAutoPortBinding(repository, container as unknown as IDockerContainer, userId, org);
    await materializeContainer(container as unknown as IDockerContainer);
    // Keep the back-reference the rest of the code relies on.
    await mongoose.model('Repository').updateOne(
        { _id: repository._id },
        { container: container._id }
    );
    return container as unknown as IDockerContainer;
};

/**
 * Best-effort webhook registration for auto-deploy. Never throws into the deploy
 * path — a repo without a webhook simply won't auto-deploy on push.
 */
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
