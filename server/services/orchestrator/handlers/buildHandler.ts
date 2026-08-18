import fs from 'fs';
import path from 'path';
import Deployment from '@models/deployment';
import DockerContainer from '@models/docker/container';
import logger from '@utilities/logger';
import { IJob } from '@typings/models/job';
import { createLogStream, appendLog, removeLogStream } from '@services/logManager';
import { resolveStrategy, getBuilder } from '@services/build';
import { BuildContext } from '@typings/services/build';
import { activityContextFromJob } from '@services/activity';
import { populateRepository } from '@services/orchestrator/provision';

const inspectSource = async (storagePath?: string): Promise<{ files: string[]; pkg?: any }> => {
    if(!storagePath) return { files: [] };
    const files = await fs.promises.readdir(storagePath).catch(() => null);
    if(!files) return { files: [] };
    if(!files.includes('package.json')) return { files };
    const raw = await fs.promises.readFile(path.join(storagePath, 'package.json'), 'utf8').catch(() => null);
    if(!raw) return { files };
    try{
        return { files, pkg: JSON.parse(raw) };
    }catch{
        return { files };
    }
};

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

    if(repository.organization) job.target.organization = repository.organization;

    const act = activityContextFromJob(job);

    await createLogStream(userId, deploymentId);

    const container: any = await DockerContainer.findById(repository.container);
    const storagePath = container?.storagePath;

    try{
        deployment.status = 'building';
        await deployment.save();

        const strategy = await act.step('Resolving build strategy', async () => {
            const { files, pkg } = await inspectSource(storagePath);
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

        await Deployment.updateOne({ _id: deploymentId }, { status: 'failure' });

        throw error;
    }finally{

        removeLogStream(deploymentId);
    }
};

export default runBuild;
