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
import Repository from '@models/repository';
import User from '@models/user';
import Github from '@services/github';
import DockerContainerService from '@services/docker/container';
import RepositoryHandler from '@services/repositoryHandler';
import sendEmail from '@services/sendEmail';
import logger from '@utilities/logger';
import { IJob } from '@typings/models/job';
import { ensureRepositoryInfra, ensureWebhook, populateRepository } from '@services/orchestrator/provision';
import { resolveStrategy } from '@services/build';
import { runBuild } from '@services/orchestrator/handlers/buildHandler';
import { getIngressLabels, ensureSubdomain } from '@services/ingress';
import { emitDeploymentStatus } from '@services/orchestrator/events';
import { activityContextFromJob } from '@services/activity';

/**
 * The durable deploy worker. This is the single place a repository is built and
 * run, funneling what used to be split between Repository.pre('save') (initial)
 * and controllers/webhook.ts (push). Reuses Github.deployRepository (clone + GH
 * deployment + Deployment record) and RepositoryHandler.start (install/build/run
 * with log streaming) rather than reimplementing them.
 *
 * payload.reason: 'initial' | 'push' | 'manual' | 'reconcile'
 */
export const runDeploy = async (job: IJob): Promise<void> => {
    const repositoryId = job.target?.repository?.toString();
    if(!repositoryId){
        throw new Error('Deploy::Repository::Required');
    }
    const reason = (job.payload?.reason as string) || 'manual';

    const repository: any = await populateRepository(repositoryId);
    if(!repository){
        throw new Error('Deploy::Repository::NotFound');
    }
    const githubUser = repository.user;
    const userId = githubUser?._id?.toString();

    // Stamp the org before building the context — it captures org at construction.
    if(repository.organization) job.target.organization = repository.organization;

    const act = activityContextFromJob(job);

    try{
    // 1. Ensure the container/network/image and webhook exist (idempotent).
    const container = await act.step('Provisioning infrastructure', () => ensureRepositoryInfra(repository));
    await act.step('Ensuring webhook', () => ensureWebhook(repository, githubUser));

    const source = new Github(githubUser, repository);
    const containerService = new DockerContainerService(container);

    emitDeploymentStatus(userId, { repositoryId, status: 'queued', jobId: job._id.toString() });

    // ROLLBACK: re-run a prior release's immutable artifact without rebuilding.
    // Requires that the target deployment recorded an artifact tag.
    if(reason === 'rollback'){
        const target: any = await mongoose.model('Deployment').findOne({
            _id: job.payload?.rollbackTo, repository: repository._id
        }).select('artifact');
        const tag = target?.artifact?.tag;
        if(!tag){
            throw new Error('Deploy::Rollback::NoArtifact');
        }
        const extraLabels = await getIngressLabels(repository).catch(() => ({}));
        act.progress('Rolling back to previous artifact');
        await containerService.removeContainer();
        await containerService.createAndStartContainer({ imageOverride: tag, extraLabels });
        // Mark the rolled-back-from release and record a new success pointer.
        await mongoose.model('Deployment').updateOne(
            { _id: job.payload?.rollbackTo },
            { status: 'success' }
        );
        emitDeploymentStatus(userId, { repositoryId, deploymentId: String(job.payload?.rollbackTo), status: 'rolledback', jobId: job._id.toString() });
        return;
    }

    // 2. For a redeploy of existing source, stop the container and wipe the work
    //    dir so the clone is clean. (Initial deploys have nothing to wipe.)
    if(reason !== 'initial'){
        try{
            await containerService.stop();
        }catch(error){
            logger.warn('@services/orchestrator/handlers/deployHandler.ts: stop before redeploy failed (continuing): ' + error);
        }
        if(container.storagePath){
            await Github.deleteLogAndDirectory('', container.storagePath);
        }
    }

    // 3. Clone + create the GitHub deployment + the Deployment release record.
    const deployment = await act.step('Cloning source & creating release', () => source.deployRepository());
    const deploymentId = deployment._id.toString();
    job.deployment = deployment._id as any;
    job.logRef = `${userId}:${container._id.toString()}`;
    // Stamp the tenant seam on the job now that the repo is loaded (links the
    // orchestrator to the Phase 2 Org>Project>Environment model).
    if(repository.project) job.target.project = repository.project;
    if(repository.environment) job.target.environment = repository.environment;
    await job.save();

    // Maintain back-references (previously done in the model hook / webhook ctrl).
    await Promise.all([
        User.updateOne({ _id: userId }, { $addToSet: { deployments: deployment._id } }),
        Repository.updateOne({ _id: repository._id }, { $addToSet: { deployments: deployment._id } })
    ]);
    if(!repository.deployments) repository.deployments = [];
    repository.deployments.push(deployment._id);

    emitDeploymentStatus(userId, { repositoryId, deploymentId, status: 'building', jobId: job._id.toString() });

    // 4. Build + run, per strategy.
    //    - 'exec' (default, back-compat): RepositoryHandler.start runs install/build/
    //      start commands inside the shared base container (no image artifact).
    //    - otherwise: produce an IMMUTABLE image artifact (Dockerfile build / prebuilt
    //      pull) recorded on the Deployment, then run THAT exact tag via imageOverride,
    //      with Traefik ingress labels applied so routing follows the container.
    const strategy = resolveStrategy(repository);
    if(strategy === 'exec'){
        const repositoryHandler = new RepositoryHandler(repository);
        await act.step('Building application', () => repositoryHandler.start(new Github(githubUser, repository)));
    }else{
        // Phase A: build the artifact (sets deployment.artifact; throws on failure).
        await act.step('Building application', () => runBuild(job));
        const built: any = await mongoose.model('Deployment').findById(deployment._id).select('artifact');
        const imageOverride = built?.artifact?.tag || undefined;
        // Auto per-app subdomain (when BASE_DOMAIN configured) + ingress labels.
        await ensureSubdomain(repository).catch(() => {});
        const extraLabels = await getIngressLabels(repository).catch(() => ({}));
        // Phase B: run the immutable artifact. Recreate the container so the new
        // image + ingress labels take effect.
        await containerService.removeContainer();
        await containerService.createAndStartContainer({ imageOverride, extraLabels });
        // The artifact ran; mark the release successful (no in-container build step).
        deployment.status = 'success';
        await deployment.save();
        await source.updateDeploymentStatus(deployment.githubDeploymentId, 'success').catch(() => {});
    }

    // 5. Reflect the final deployment status in the live event + notify.
    const finalDeployment = await mongoose.model('Deployment').findById(deployment._id).select('status');
    const finalStatus = finalDeployment?.status || 'success';
    emitDeploymentStatus(userId, { repositoryId, deploymentId, status: finalStatus, jobId: job._id.toString() });

    if(finalStatus === 'success' && githubUser?.email){
        sendEmail({
            to: githubUser.email,
            subject: `Deployment for "${repository.alias}" completed successfully.`,
            html: `Hello @${githubUser.username},<br><br>The "${repository.alias}" repository has been deployed. It should be available in a few moments.<br><br>Regards.`
        }).catch(() => {});
    }

    if(finalStatus === 'failure'){
        // Surface failure to the queue so retry/backoff applies.
        throw new Error(`Deploy::Build::Failed::${repository.alias}`);
    }

    act.success(`Deployment for "${repository.alias}" completed`);
    }catch(error){
        act.fail('Deployment failed', error);
        throw error;
    }
};

export default runDeploy;
