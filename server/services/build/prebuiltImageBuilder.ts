import { getDockerHost } from '@services/docker/host';
import { appendLog } from '@services/logManager';
import logger from '@utilities/logger';
import { BuilderStrategy, BuildContext, Artifact } from '@typings/services/build';
import { artifactTag } from '@services/build/dockerfileBuilder';

const splitImageRef = (ref: string): { name: string; tag: string } => {

    const lastSlash = ref.lastIndexOf('/');
    const lastColon = ref.lastIndexOf(':');
    if(lastColon > lastSlash) return { name: ref.slice(0, lastColon), tag: ref.slice(lastColon + 1) };
    return { name: ref, tag: 'latest' };
};

class PrebuiltImageBuilder implements BuilderStrategy{
    async build(ctx: BuildContext): Promise<Artifact>{
        const { repository, deployment, nodeId } = ctx;
        const source = repository.image;
        if(!source){
            throw new Error('Build::PrebuiltImage::repository.image::Required');
        }
        const repositoryId = repository._id.toString();
        const deploymentId = deployment._id.toString();
        const userId = (repository.user as any)?._id?.toString() || repository.user?.toString();
        const { name, tag: srcTag } = splitImageRef(source);
        const targetTag = artifactTag(nodeId, repositoryId, deploymentId);
        const docker = getDockerHost(nodeId).client();

        appendLog(userId, deploymentId, `[build] Pulling prebuilt image ${name}:${srcTag}\n`);
        try{
            const stream = await docker.pull(`${name}:${srcTag}`);
            await new Promise<void>((resolve, reject) => {
                docker.modem.followProgress(stream, (err: any) => (err ? reject(err) : resolve()));
            });
        }catch(error: any){
            const msg = error?.message || String(error);
            if(/unauthorized|denied|401/i.test(msg)){
                throw new Error('Build::Registry::Unauthorized');
            }
            throw error;
        }

        await docker.getImage(`${name}:${srcTag}`).tag({ repo: `quantum-${nodeId}/${repositoryId}`, tag: deploymentId });
        appendLog(userId, deploymentId, `[build] Tagged as ${targetTag}\n`);

        const inspect = await docker.getImage(targetTag).inspect();
        const digest = inspect.Id;
        const sizeBytes = inspect.Size || 0;
        logger.info(`@services/build/prebuiltImageBuilder: tagged ${source} as ${targetTag} (${digest})`);

        return { image: source, tag: targetTag, digest, builder: 'prebuilt-image', sizeBytes };
    }
}

export default PrebuiltImageBuilder;
