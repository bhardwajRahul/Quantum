import DockerContainer from '@models/docker/container';
import DockerContainerService from '@services/docker/container';
import logger from '@utilities/logger';
import { IJob } from '@typings/models/job';

export const runReload = async (job: IJob): Promise<void> => {
    const containerId = job.target?.container?.toString();
    if(!containerId){
        throw new Error('Reload::Container::Required');
    }
    const container = await DockerContainer.findById(containerId);
    if(!container){

        logger.warn('@services/orchestrator/handlers/reloadHandler.ts (runReload): container not found: ' + containerId);
        return;
    }
    const service = new DockerContainerService(container);
    await service.reloadContainer();
};

export default runReload;
