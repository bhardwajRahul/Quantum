import { getDockerHost } from '../DockerHost';
import { pullImage } from '../pullImage';
import { artifactTag } from './DockerfileBuilder';
import { emitBuildLog, type BuilderStrategy, type BuildContext } from './BuildContext';
import { logger } from '@/shared/utils/Logger';
import type { DeploymentArtifact } from '@quantum/contracts/modules/deployment/domain';

const splitImageRef = (ref: string): { name: string; tag: string } => {
    const lastSlash = ref.lastIndexOf('/');
    const lastColon = ref.lastIndexOf(':');
    if(lastColon > lastSlash) return { name: ref.slice(0, lastColon), tag: ref.slice(lastColon + 1) };
    return { name: ref, tag: 'latest' };
};

export default class PrebuiltImageBuilder implements BuilderStrategy{
    async build(ctx: BuildContext): Promise<DeploymentArtifact>{
        const { repository, deployment, nodeId } = ctx;
        const source = repository.image;
        if(!source) throw new Error('Build::PrebuiltImage::repository.image::Required');

        const { name, tag: srcTag } = splitImageRef(source);
        const targetTag = artifactTag(nodeId, repository.id, deployment.id);
        const docker = getDockerHost(nodeId).client();

        emitBuildLog(deployment, `[build] Pulling prebuilt image ${name}:${srcTag}\n`);
        await pullImage(docker, `${name}:${srcTag}`, { organizationId: repository.organizationId ?? 0, userId: repository.userId });

        await docker.getImage(`${name}:${srcTag}`).tag({ repo: `quantum-${nodeId}/${repository.id}`, tag: String(deployment.id) });
        emitBuildLog(deployment, `[build] Tagged as ${targetTag}\n`);

        const inspect = await docker.getImage(targetTag).inspect();
        const digest = inspect.Id;
        const sizeBytes = inspect.Size || 0;
        logger.info(`tagged ${source} as ${targetTag} (${digest})`, { scope: 'orchestrator.build' });

        return { image: source, tag: targetTag, digest, builder: 'prebuilt-image', sizeBytes };
    }
}
