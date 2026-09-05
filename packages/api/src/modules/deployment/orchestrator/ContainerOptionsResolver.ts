import Dockerode from 'dockerode';
import slugify from 'slugify';
import { getDockerHost } from './DockerHost';
import DockerContainer from '@/modules/docker/models/DockerContainer';
import DockerImage from '@/modules/docker/models/DockerImage';
import DockerNetwork from '@/modules/docker/models/DockerNetwork';
import PortBinding from '@/modules/codespace/models/PortBinding';
import type { ContainerOverrides } from './ContainerOps';

export default class ContainerOptionsResolver{
    constructor(private container: DockerContainer){}

    async resolve(overrides: ContainerOverrides = {}): Promise<Dockerode.ContainerCreateOptions>{
        const image = await this.#imageRef(overrides.imageOverride);
        const networkName = await this.#networkName();
        const { exposedPorts, bindings } = await this.#portBindings();
        const mounts = await this.#volumeMounts();
        const binds = this.#binds();
        const env = [
            ...Object.entries(this.container.environmentVariables).map(([key, value]) => `${key}=${value}`),
            ...(overrides.extraEnv ?? [])
        ];

        const options: Dockerode.ContainerCreateOptions = {
            Image: image,
            name: this.container.dockerContainerName,
            Tty: true,
            OpenStdin: true,
            StdinOnce: true,
            Env: env,
            ExposedPorts: exposedPorts,
            HostConfig: {
                PortBindings: bindings,
                Binds: binds,
                Mounts: mounts,
                NetworkMode: networkName,
                RestartPolicy: { Name: 'always' }
            }
        };
        if(overrides.extraLabels && Object.keys(overrides.extraLabels).length > 0){
            options.Labels = { ...overrides.extraLabels };
        }
        return options;
    }

    async #imageRef(imageOverride?: string): Promise<string>{
        if(imageOverride) return imageOverride;
        const image = await DockerImage.findOneBy({ id: this.container.imageId });
        if(!image) throw new Error('Container::Image::NotFound');
        return `${image.name}:${image.tag}`;
    }

    async #networkName(): Promise<string>{
        const network = await DockerNetwork.findOneBy({ id: this.container.networkId });
        if(!network) throw new Error('Container::Network::NotFound');

        /*
         * The persisted name, not one recomposed from ids. `materializeNetwork` created
         * the Docker network as `network.dockerNetworkName`, so anything else is a guess
         * at what Docker was told — and a wrong guess only surfaces as a 404 from the
         * daemon at container-create time, long after provisioning reported success.
         */
        if(!network.dockerNetworkName) throw new Error('Container::Network::NotMaterialized');
        return network.dockerNetworkName;
    }

    async #portBindings(): Promise<{ exposedPorts: Record<string, object>; bindings: Record<string, Array<{ HostPort: string }>> }>{
        const portBindings = await PortBinding.find({ where: { containerId: this.container.id } });
        const exposedPorts: Record<string, object> = {};
        const bindings: Record<string, Array<{ HostPort: string }>> = {};
        for(const { internalPort, protocol, externalPort } of portBindings){
            const key = `${internalPort}/${protocol}`;
            exposedPorts[key] = {};
            bindings[key] = [{ HostPort: `${externalPort}` }];
        }
        return { exposedPorts, bindings };
    }

    async #volumeMounts(): Promise<Dockerode.MountSettings[]>{
        const docker = getDockerHost().client();
        const mounts: Dockerode.MountSettings[] = [];
        for(const { containerPath, mode } of this.container.volumes){
            const volumeName = `${this.container.dockerContainerName}-${slugify(containerPath)}`;
            await this.#ensureVolume(docker, volumeName);
            mounts.push({ Source: volumeName, Target: containerPath, Type: 'volume', ReadOnly: mode === 'ro' });
        }
        return mounts;
    }

    async #ensureVolume(docker: Dockerode, volumeName: string): Promise<void>{
        try{
            await docker.createVolume({ Name: volumeName, Labels: { container: this.container.dockerContainerName } });
        }catch(error){
            if((error as { statusCode?: number }).statusCode !== 409) throw error;
        }
    }

    #binds(): string[] | undefined{
        if(!this.container.isRepositoryContainer) return undefined;
        if(!this.container.storagePath) throw new Error('Container::StoragePath::Required');
        return [`${this.container.storagePath}:/app:rw`];
    }
}
