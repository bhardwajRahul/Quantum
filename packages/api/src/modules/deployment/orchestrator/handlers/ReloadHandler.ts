import DockerContainer from '@/modules/docker/models/DockerContainer';
import Repository from '@/modules/repository/models/Repository';
import ContainerOps from '../ContainerOps';
import IngressService from '../IngressService';
import { logger } from '@/shared/utils/Logger';
import type Job from '../../models/Job';

export default class ReloadHandler{
    #ingress = new IngressService();

    async run(job: Job): Promise<void>{
        if(!job.containerId) throw new Error('Reload::Container::Required');
        const container = await DockerContainer.findOneBy({ id: job.containerId });
        if(!container){
            logger.warn(`reload: container not found ${job.containerId}`, { scope: 'orchestrator.handler.reload' });
            return;
        }
        const extraLabels = await this.#ingressLabels(container);
        await new ContainerOps(container).reloadContainer(extraLabels ? { extraLabels } : {});
    }

    async #ingressLabels(container: DockerContainer): Promise<Record<string, string> | undefined>{
        if(!container.repositoryId) return undefined;
        const repository = await Repository.findOneBy({ id: container.repositoryId });
        if(!repository) return undefined;
        const labels = await this.#ingress.getIngressLabels(repository).catch(() => ({}));
        return Object.keys(labels).length > 0 ? labels : undefined;
    }
}
