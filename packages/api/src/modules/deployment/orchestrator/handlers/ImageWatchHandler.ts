import TemplateInstall from '@/modules/template/models/TemplateInstall';
import TemplateInstallService from '@/modules/template/services/TemplateInstallService';
import { TemplateInstallStatus } from '@quantum/contracts/modules/template/domain';
import { getDockerHost } from '../DockerHost';
import { pullImage } from '../pullImage';
import { logger } from '@/shared/utils/Logger';
import type Dockerode from 'dockerode';

const imageId = async (docker: Dockerode, ref: string): Promise<string | null> => {
    try{
        return (await docker.getImage(ref).inspect()).Id;
    }catch{
        return null;
    }
};

export default class ImageWatchHandler{
    async run(jobNodeId: string): Promise<void>{
        const nodeId = jobNodeId || 'local';
        const installs = await TemplateInstall.find({ where: { watchImages: true, status: TemplateInstallStatus.Running } });

        for(const install of installs){
            try{
                await this.#check(install, nodeId);
            }catch(error){
                logger.warn(`image watch ${install.name}: ${(error as Error).message}`, { scope: 'orchestrator.handler.image-watch' });
            }
        }
    }

    async #check(install: TemplateInstall, nodeId: string): Promise<void>{
        const docker = getDockerHost(nodeId).client();
        const scope = { organizationId: install.organizationId ?? 0, userId: install.userId };
        const updated: string[] = [];

        for(const service of install.services){
            const before = await imageId(docker, service.image);
            await pullImage(docker, service.image, scope);
            const after = await imageId(docker, service.image);
            if(before !== null && after !== null && before !== after) updated.push(service.name);
        }

        if(updated.length === 0) return;
        await new TemplateInstallService().requestRedeploy(
            install,
            'orchestrator.image-watch',
            `${install.name}: new image for ${updated.join(', ')}`,
            'Redeploying the stack with the updated images.'
        );
    }
}
