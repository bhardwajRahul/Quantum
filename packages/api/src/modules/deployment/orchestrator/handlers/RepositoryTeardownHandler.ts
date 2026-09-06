import Deployment from '../../models/Deployment';
import DockerContainer from '@/modules/docker/models/DockerContainer';
import DockerNetwork from '@/modules/docker/models/DockerNetwork';
import PortBinding from '@/modules/docker/models/PortBinding';
import ContainerOps from '../ContainerOps';
import { teardownNetwork } from '../NetworkOps';
import { failureMessage } from '../failureMessage';
import { logger } from '@/shared/utils/Logger';
import type Job from '../../models/Job';

export default class RepositoryTeardownHandler{
    async run(job: Job): Promise<void>{
        const repositoryId = job.repositoryId ?? (job.payload.repositoryId as number | undefined);
        if(repositoryId === undefined) throw new Error('Teardown::Repository::Required');

        for(const container of await DockerContainer.findBy({ repositoryId })){
            await new ContainerOps(container).removeContainer().catch((error) =>
                logger.warn(`could not remove ${container.dockerContainerName} — ${failureMessage(error)}`, { scope: 'orchestrator.handler.teardown' }));
            await PortBinding.delete({ containerId: container.id });
            await container.remove();

            const network = await DockerNetwork.findOneBy({ id: container.networkId });
            if(network){
                await teardownNetwork(network);
                await network.remove();
            }
        }

        await Deployment.delete({ repositoryId });
        logger.info(`repository ${repositoryId} torn down`, { scope: 'orchestrator.handler.teardown' });
    }
}
