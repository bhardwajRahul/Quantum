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

import fs from 'fs';
import path from 'path';
import mongoose from 'mongoose';
import Deployment from '@models/deployment';
import DockerContainer from '@models/docker/container';
import logger from '@utilities/logger';
import { IJob } from '@typings/models/job';
import { createLogStream, appendLog } from '@services/logManager';
import { resolveStrategy, getBuilder } from '@services/build';
import { BuildContext } from '@typings/services/build';
import { activityContextFromJob } from '@services/activity';
import { populateRepository } from '@services/orchestrator/provision';

/**
 * Read the top-level file list + package.json from the cloned source so
 * resolveStrategy can auto-detect when the repo's buildStrategy is 'auto'. Best
 * effort: a missing/unreadable dir just yields no auto-detection signal.
 */
const inspectSource = (storagePath?: string): { files: string[]; pkg?: any } => {
    if(!storagePath) return { files: [] };
    try{
        const files = fs.readdirSync(storagePath);
        let pkg: any;
        if(files.includes('package.json')){
            try{ pkg = JSON.parse(fs.readFileSync(path.join(storagePath, 'package.json'), 'utf8')); }
            catch{ /* malformed package.json — ignore for detection */ }
        }
        return { files, pkg };
    }catch{
        return { files: [] };
    }
};

/**
 * The build worker. Produces (and records) the immutable image artifact a release
 * runs, WITHOUT running it — deployHandler orchestrates build-then-run and calls
 * the deploy step itself. Here we: load the Repository (+user/github) and the
 * target Deployment, mark it 'building', resolve+run the builder strategy, and
 * persist the returned Artifact onto deployment.artifact. On failure we set
 * 'failure' and rethrow so the queue's retry/backoff applies.
 */
export const runBuild = async (job: IJob): Promise<void> => {
    const repositoryId = job.target?.repository?.toString();
    const deploymentId = job.target?.deployment?.toString();
    if(!repositoryId) throw new Error('Build::Repository::Required');
    if(!deploymentId) throw new Error('Build::Deployment::Required');

    const repository: any = await populateRepository(repositoryId);
    if(!repository) throw new Error('Build::Repository::NotFound');

    const deployment: any = await Deployment.findById(deploymentId);
    if(!deployment) throw new Error('Build::Deployment::NotFound');

    const userId = repository.user?._id?.toString() || repository.user?.toString();
    const nodeId = job.nodeId || process.env.NODE_ID || 'local';

    // Stamp the org before building the context — it captures org at construction.
    if(repository.organization) job.target.organization = repository.organization;

    const act = activityContextFromJob(job);

    // The build streams its progress onto a log channel keyed by deploymentId, the
    // same channel the deploy UI follows.
    await createLogStream(userId, deploymentId);

    const container: any = await DockerContainer.findById(repository.container);
    const storagePath = container?.storagePath;

    try{
        deployment.status = 'building';
        await deployment.save();

        const strategy = await act.step('Resolving build strategy', async () => {
            const { files, pkg } = inspectSource(storagePath);
            const resolved = resolveStrategy(repository, files, pkg);
            appendLog(userId, deploymentId, `[build] Strategy resolved to "${resolved}"\n`);
            logger.info(`@services/orchestrator/handlers/buildHandler: repo=${repositoryId} deployment=${deploymentId} strategy=${resolved}`);
            return resolved;
        });

        const builder = getBuilder(strategy);
        const ctx: BuildContext = { repository, deployment, container, nodeId, storagePath };
        const artifact = await act.step('Building image artifact', () => builder.build(ctx));

        await act.step('Recording artifact', async () => {
            deployment.artifact = artifact;
            await deployment.save();
            appendLog(userId, deploymentId, `[build] Artifact recorded (builder=${artifact.builder}, tag=${artifact.tag || 'n/a'})\n`);
        });
    }catch(error: any){
        logger.error('@services/orchestrator/handlers/buildHandler: ' + error);
        appendLog(userId, deploymentId, `[build] FAILED: ${error?.message || error}\n`);
        act.fail('Build failed', error);
        // Reload defensively: the build can take a while; avoid clobbering a
        // concurrent status write with a stale in-memory doc.
        await mongoose.model('Deployment').updateOne({ _id: deploymentId }, { status: 'failure' });
        // Rethrow so the queue retries with backoff.
        throw error;
    }
};

export default runBuild;
