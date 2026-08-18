import path from 'path';
import { getDockerHost } from '@services/docker/host';
import { appendLog } from '@services/logManager';
import logger from '@utilities/logger';
import { BuilderStrategy, BuildContext, Artifact } from '@typings/services/build';

export const artifactTag = (nodeId: string, repositoryId: string, deploymentId: string): string =>
    `quantum-${nodeId}/${repositoryId}:${deploymentId}`;

class DockerfileBuilder implements BuilderStrategy{
    async build(ctx: BuildContext): Promise<Artifact>{
        const { repository, deployment, nodeId, storagePath } = ctx;
        const repositoryId = repository._id.toString();
        const deploymentId = deployment._id.toString();
        const userId = (repository.user as any)?._id?.toString() || repository.user?.toString();
        const tag = artifactTag(nodeId, repositoryId, deploymentId);
        const dockerfile = repository.dockerfilePath || 'Dockerfile';
        const docker = getDockerHost(nodeId).client();

        const rootDir = (repository.rootDirectory || '').replace(/^\/+/, '');
        const context = rootDir ? path.join(storagePath || '.', rootDir) : (storagePath || '.');

        appendLog(userId, deploymentId, `[build] Building image ${tag} from ${dockerfile}${rootDir ? ' (root=' + rootDir + ')' : ''}\n`);

        const stream = await docker.buildImage(
            { context, src: ['.'] },
            { t: tag, dockerfile }
        );

        await new Promise<void>((resolve, reject) => {
            docker.modem.followProgress(
                stream,
                (err: any, output: any[]) => {
                    if(err) return reject(err);

                    const failure = (output || []).find((frame: any) => frame.error || frame.errorDetail);
                    if(failure) return reject(new Error(failure.error || failure.errorDetail?.message || 'docker build failed'));
                    resolve();
                },
                (event: any) => {
                    const line = event.stream || event.status || (event.errorDetail?.message) || '';
                    if(line) appendLog(userId, deploymentId, line.endsWith('\n') ? line : line + '\n');
                }
            );
        });

        const inspect = await docker.getImage(tag).inspect();
        const digest = inspect.Id;
        const sizeBytes = inspect.Size || 0;
        appendLog(userId, deploymentId, `[build] Built ${tag} (${digest}, ${sizeBytes} bytes)\n`);
        logger.info(`@services/build/dockerfileBuilder: built ${tag} (${digest})`);

        return { image: tag, tag, digest, builder: 'dockerfile', sizeBytes };
    }
}

export default DockerfileBuilder;
