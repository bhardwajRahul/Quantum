import Domain from '@/modules/domain/models/Domain';
import DockerContainer from '@/modules/docker/models/DockerContainer';
import Repository from '@/modules/repository/models/Repository';
import ContainerOps from '../ContainerOps';
import IngressService from '../IngressService';
import { DomainStatus } from '@quantum/contracts/modules/domain/domain';
import { logger } from '@/shared/utils/Logger';
import type Job from '../../models/Job';

export default class IngressHandler{
    #ingress = new IngressService();

    async run(job: Job): Promise<void>{
        if(!job.repositoryId) throw new Error('Ingress::Repository::Required');
        const repository = await Repository.findOneBy({ id: job.repositoryId });
        if(!repository) throw new Error('Ingress::Repository::NotFound');
        await this.applyIngress(repository);
    }

    async applyIngress(repository: Repository): Promise<void>{
        try{
            const labels = await this.#ingress.getIngressLabels(repository);
            const container = await DockerContainer.findOneBy({ repositoryId: repository.id });
            if(!container || !container.dockerContainerName){
                logger.info(`no container for repository ${repository.id} yet`, { scope: 'orchestrator.handler.ingress' });
                return;
            }

            await this.#ingress.connectContainerToEdge(container.dockerContainerName);
            if(Object.keys(labels).length > 0){
                await new ContainerOps(container).reloadContainer({ extraLabels: labels });
            }

            const status = Object.keys(labels).length > 0 ? DomainStatus.Active : DomainStatus.Pending;
            await Domain.update({ repositoryId: repository.id }, { status });
            logger.info(`ingress synced for repository ${repository.id} (status=${status})`, { scope: 'orchestrator.handler.ingress' });
        }catch(error){
            logger.error(`applyIngress failed for repository ${repository.id}`, error, { scope: 'orchestrator.handler.ingress' });
            await Domain.update({ repositoryId: repository.id }, { status: DomainStatus.Error }).catch(() => undefined);
        }
    }
}
