import Dockerode from 'dockerode';
import DockerContainer from '../models/DockerContainer';
import { DockerError } from '../contracts/domain/errors';
import { ContainerOperation, ContainerStatus } from '@quantum/contracts/modules/docker/domain';
import { logger } from '@/shared/utils/Logger';

export default class ContainerService{
    #docker = new Dockerode();

    async list(): Promise<DockerContainer[]>{
        return DockerContainer.find({ order: { id: 'ASC' } });
    }

    async get(id: number): Promise<DockerContainer>{
        const container = await DockerContainer.findOneBy({ id: id });
        if(!container) throw DockerError.NotFound();
        return container;
    }

    async operate(id: number, operation: ContainerOperation): Promise<DockerContainer>{
        const container = await this.get(id);

        try{
            if(operation === ContainerOperation.Start) await this.#start(container);
            if(operation === ContainerOperation.Stop) await this.#stop(container);
            if(operation === ContainerOperation.Restart) await this.#restart(container);
        }catch(error){
            logger.error(`Docker operation "${operation}" failed for container ${container.dockerContainerName}`, error);
            throw DockerError.OperationFailed();
        }

        return container;
    }

    async #start(container: DockerContainer): Promise<void>{
        const live = this.#docker.getContainer(container.dockerContainerName);
        const { State } = await live.inspect();
        if(State.Running) return;

        await live.start();
        container.status = ContainerStatus.Running;
        container.startedAt = new Date();
        await container.save();
    }

    async #stop(container: DockerContainer): Promise<void>{
        const live = this.#docker.getContainer(container.dockerContainerName);
        await live.stop({ t: 10 });
        container.status = ContainerStatus.Stopped;
        container.stoppedAt = new Date();
        await container.save();
    }

    async #restart(container: DockerContainer): Promise<void>{
        const live = this.#docker.getContainer(container.dockerContainerName);
        container.status = ContainerStatus.Restarting;
        await container.save();

        await live.restart({ t: 10 });
        container.status = ContainerStatus.Running;
        container.startedAt = new Date();
        await container.save();
    }
}
