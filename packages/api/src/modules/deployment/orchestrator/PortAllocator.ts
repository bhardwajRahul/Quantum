import { getDockerHost } from './DockerHost';
import PortBinding from '@/modules/docker/models/PortBinding';
import { logger } from '@/shared/utils/Logger';

const RANGE_START = 20_000;
const RANGE_END = 45_000;

const takenPorts = async (): Promise<Set<number>> => {
    const taken = new Set<number>();

    for(const { externalPort } of await PortBinding.find({ select: { externalPort: true } })){
        taken.add(externalPort);
    }

    try{
        const containers = await getDockerHost().listContainers({ all: true });
        for(const container of containers){
            for(const port of container.Ports ?? []){
                if(port.PublicPort) taken.add(port.PublicPort);
            }
        }
    }catch(error){
        logger.warn(`port allocation could not read Docker's published ports — ${(error as Error).message}`,
            { scope: 'orchestrator.ports' });
    }

    return taken;
};

export const allocateHostPort = async (): Promise<number> => {
    const taken = await takenPorts();

    for(let port = RANGE_START; port <= RANGE_END; port++){
        if(!taken.has(port)) return port;
    }

    throw new Error(`Docker::Ports::Exhausted::${RANGE_START}-${RANGE_END}`);
};
