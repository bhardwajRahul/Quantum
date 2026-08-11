import path from 'node:path';
import type Dockerode from 'dockerode';
import { getDockerHost } from '../DockerHost';
import { emitBuildLog, type BuilderStrategy, type BuildContext } from './BuildContext';
import { logger } from '@/shared/utils/Logger';
import type Deployment from '../../models/Deployment';
import type { DeploymentArtifact } from '@quantum/contracts/modules/deployment/domain';

export const artifactTag = (nodeId: string, repositoryId: number, deploymentId: number): string =>
    `quantum-${nodeId}/${repositoryId}:${deploymentId}`;

interface BuildFrame{
    error?: string;
    errorDetail?: { message?: string };
}

interface ProgressEvent{
    stream?: string;
    status?: string;
    errorDetail?: { message?: string };
}

export default class DockerfileBuilder implements BuilderStrategy{
    async build(ctx: BuildContext): Promise<DeploymentArtifact>{
        const { repository, deployment, nodeId, storagePath } = ctx;
        const tag = artifactTag(nodeId, repository.id, deployment.id);
        const dockerfile = repository.dockerfilePath || 'Dockerfile';
        const docker = getDockerHost(nodeId).client();

        const rootDir = (repository.rootDirectory || '').replace(/^\/+/, '');
        const context = rootDir ? path.join(storagePath || '.', rootDir) : (storagePath || '.');

        emitBuildLog(deployment, `[build] Building image ${tag} from ${dockerfile}${rootDir ? ' (root=' + rootDir + ')' : ''}\n`);

        const stream = await docker.buildImage({ context, src: ['.'] }, { t: tag, dockerfile });
        await this.#follow(docker, stream, deployment);

        const inspect = await docker.getImage(tag).inspect();
        const digest = inspect.Id;
        const sizeBytes = inspect.Size || 0;
        emitBuildLog(deployment, `[build] Built ${tag} (${digest}, ${sizeBytes} bytes)\n`);
        logger.info(`built ${tag} (${digest})`, { scope: 'orchestrator.build' });

        return { image: tag, tag, digest, builder: 'dockerfile', sizeBytes };
    }

    #follow(docker: Dockerode, stream: NodeJS.ReadableStream, deployment: Deployment): Promise<void>{
        return new Promise<void>((resolve, reject) => {
            docker.modem.followProgress(
                stream,
                (err: Error | null, output: BuildFrame[]) => {
                    if(err) return reject(err);
                    const failure = (output || []).find((frame) => frame.error || frame.errorDetail);
                    if(failure) return reject(new Error(failure.error || failure.errorDetail?.message || 'docker build failed'));
                    resolve();
                },
                (event: ProgressEvent) => {
                    const line = event.stream || event.status || event.errorDetail?.message || '';
                    if(line) emitBuildLog(deployment, line.endsWith('\n') ? line : line + '\n');
                }
            );
        });
    }
}
