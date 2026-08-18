import Dockerode from 'dockerode';

export interface DockerHost{
    readonly nodeId: string;

    client(): Dockerode;
    getContainer(name: string): Dockerode.Container;
    getImage(name: string): Dockerode.Image;
    listContainers(options?: Dockerode.ContainerListOptions): Promise<Dockerode.ContainerInfo[]>;
}

class LocalDockerHost implements DockerHost{
    readonly nodeId: string;
    private docker: Dockerode;

    constructor(nodeId: string){
        this.nodeId = nodeId;

        this.docker = new Dockerode();
    }

    client(): Dockerode{
        return this.docker;
    }

    getContainer(name: string): Dockerode.Container{
        return this.docker.getContainer(name);
    }

    getImage(name: string): Dockerode.Image{
        return this.docker.getImage(name);
    }

    listContainers(options: Dockerode.ContainerListOptions = {}): Promise<Dockerode.ContainerInfo[]>{
        return this.docker.listContainers(options);
    }
}

const hosts = new Map<string, DockerHost>();

export const getDockerHost = (nodeId: string = 'local'): DockerHost => {
    let host = hosts.get(nodeId);
    if(!host){
        host = new LocalDockerHost(nodeId);
        hosts.set(nodeId, host);
    }
    return host;
};

export default getDockerHost;
