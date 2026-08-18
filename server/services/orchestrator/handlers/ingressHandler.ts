import Domain from '@models/domain';
import DockerContainer from '@models/docker/container';
import Repository from '@models/repository';
import DockerContainerService from '@services/docker/container';
import { getIngressLabels, connectContainerToEdge } from '@services/ingress';
import logger from '@utilities/logger';
import { IJob } from '@typings/models/job';
import { IRepository } from '@typings/models/repository';

export const applyIngress = async (repository: IRepository): Promise<void> => {
    if(process.env.INGRESS_ENABLED === 'false') return;
    try{
        const labels = await getIngressLabels(repository);

        const container = await DockerContainer.findOne({ repository: repository._id });

        if(!container || !container.dockerContainerName){
            logger.info(`@services/orchestrator/handlers/ingressHandler (applyIngress): no container for repository ${repository._id} yet`);
            return;
        }

        await connectContainerToEdge('local', container.dockerContainerName);

        if(Object.keys(labels).length > 0){
            const service = new DockerContainerService(container);
            await service.reloadContainer({ extraLabels: labels });
        }

        const status = Object.keys(labels).length > 0 ? 'active' : 'pending';
        await Domain.updateMany({ repository: repository._id }, { status });
        logger.info(`@services/orchestrator/handlers/ingressHandler (applyIngress): ingress synced for repository ${repository._id} (status=${status})`);
    }catch(error: any){
        logger.error(`@services/orchestrator/handlers/ingressHandler (applyIngress): ${error?.message || error}`);
        await Domain.updateMany({ repository: repository._id }, { status: 'error' }).catch(() => {});
    }
};

export const runIngressSync = async (job: IJob): Promise<void> => {
    const repositoryId = job.target?.repository?.toString();
    if(!repositoryId){
        throw new Error('Ingress::Repository::Required');
    }
    const repository = await Repository.findById(repositoryId);
    if(!repository){
        throw new Error('Ingress::Repository::NotFound');
    }
    await applyIngress(repository);
};

export default runIngressSync;
