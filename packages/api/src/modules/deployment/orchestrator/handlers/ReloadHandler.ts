import DockerContainer from '@/modules/docker/models/DockerContainer';
import ContainerOps from '../ContainerOps';
import { logger } from '@/shared/utils/Logger';
import type Job from '../../models/Job';

export default class ReloadHandler{
    async run(job: Job): Promise<void>{
        if(!job.containerId) throw new Error('Reload::Container::Required');
        const container = await DockerContainer.findOneBy({ id: job.containerId });
        if(!container){
            logger.warn(`reload: container not found ${job.containerId}`, { scope: 'orchestrator.handler.reload' });
            return;
        }
        await new ContainerOps(container).reloadContainer();
    }
}
