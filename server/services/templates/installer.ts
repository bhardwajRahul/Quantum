import { v4 } from 'uuid';
import DockerContainer from '@models/docker/container';
import DockerImage from '@models/docker/image';
import DockerNetwork from '@models/docker/network';
import PortBinding from '@models/portBinding';
import { findRandomAvailablePort } from '@utilities/helpers';
import DockerContainerService, { materializeContainer } from '@services/docker/container';
import { createAndMaterializeNetwork } from '@services/docker/network';
import { createAndMaterializeImage } from '@services/docker/image';
import { splitImageRef, topologicalOrder } from '@services/templates/compose';
import { ServicePortBindings } from '@services/templates/interpolate';
import logger from '@utilities/logger';
import { TemplateSpec } from '@typings/models/template';
import { ITemplateInstall } from '@typings/models/templateInstall';
import { IDockerContainer } from '@typings/models/docker/container';

const sanitizeName = (raw: string): string =>
    raw.toLowerCase().replace(/[^a-z0-9_.-]/g, '-').replace(/^-+|-+$/g, '').slice(0, 48) || 'svc';

const ensureNetwork = async (install: ITemplateInstall, userId: string) => {
    if(install.network){
        const existing = await DockerNetwork.findById(install.network);
        if(existing) return existing;
    }
    const network = await createAndMaterializeNetwork({
        name: `tmpl-${sanitizeName(install.name)}-${v4().slice(0, 6)}-net`,
        user: userId,
        organization: install.organization
    });
    install.network = network._id as any;
    await install.save();
    return network;
};

export const ensureInstallInfra = async (
    install: ITemplateInstall,
    spec: TemplateSpec,
    options: { skipServices?: Set<string> } = {}
): Promise<Record<string, IDockerContainer>> => {
    const userId = install.user?.toString();
    if(!userId){
        throw new Error('Template::Install::MissingOwner');
    }
    const organizationId = install.organization;

    const network = await ensureNetwork(install, userId);

    const recorded = new Map(install.services.map((service) => [service.name, service]));
    const containers: Record<string, IDockerContainer> = {};
    const skip = options.skipServices || new Set<string>();

    for(const serviceName of topologicalOrder(spec)){

        if(skip.has(serviceName)) continue;
        const service = spec.services[serviceName];

        const prior = recorded.get(serviceName);
        if(prior?.container){
            const existing = await DockerContainer.findById(prior.container);
            if(existing){
                containers[serviceName] = existing as IDockerContainer;
                continue;
            }
        }

        if(!service.image){
            throw new Error(`Template::Install::ServiceMissingImage::${serviceName}`);
        }

        const { name: imageName, tag } = splitImageRef(service.image);
        let image = await DockerImage.findOne({ user: userId, name: imageName, tag });
        if(!image){
            image = await createAndMaterializeImage({ user: userId, organization: organizationId, name: imageName, tag });
        }

        const containerName = `${sanitizeName(install.name)}-${sanitizeName(serviceName)}-${v4().slice(0, 4)}`;
        const envVariables = new Map<string, string>(Object.entries(service.environment || {}));
        const container = await DockerContainer.create({
            user: userId,
            organization: organizationId,
            image: image._id,
            network: network._id,
            name: containerName,
            command: service.command,
            volumes: (service.volumes || []).map((volume) => ({
                containerPath: volume.path,
                mode: volume.mode === 'ro' ? 'ro' : 'rw'
            })),
            environment: { variables: envVariables }
        }) as IDockerContainer;
        try{
            await materializeContainer(container);

            let boundAny = false;
            for(const port of service.ports || []){
                const externalPort = await findRandomAvailablePort();
                if(externalPort === -1){
                    throw new Error(`Template::Install::NoFreePort::${serviceName}`);
                }
                await PortBinding.create({
                    container: container._id,
                    user: userId,
                    organization: organizationId,
                    internalPort: port.target,
                    protocol: port.protocol === 'udp' ? 'udp' : 'tcp',
                    externalPort
                });
                boundAny = true;
            }

            if(boundAny){
                await new DockerContainerService(container).reloadContainer();
            }

            containers[serviceName] = container;
            install.services.push({
                name: serviceName,
                container: container._id as any,
                role: service.kind === 'database' ? 'database' : 'app'
            });
            logger.info(`@services/templates/installer.ts (ensureInstallInfra): provisioned service ${serviceName} (${containerName})`);
        }catch(error){

            await DockerContainer.findOneAndDelete({ _id: container._id }).catch(() => {});
            throw error;
        }
    }

    await install.save();
    return containers;
};

export const collectPortBindings = async (
    containers: Record<string, IDockerContainer>
): Promise<ServicePortBindings> => {
    const result: ServicePortBindings = {};
    for(const [serviceName, container] of Object.entries(containers)){
        const bindings = await PortBinding
            .find({ container: container._id })
            .select('internalPort externalPort')
            .lean();
        const portMap: Record<number, number> = {};
        let primary: number | undefined;
        for(const binding of bindings){
            const internal = Number(binding.internalPort);
            const external = Number(binding.externalPort);
            portMap[internal] = external;
            if(primary === undefined) primary = external;
        }
        result[serviceName] = { externalPort: primary, portMap };
    }
    return result;
};

export default ensureInstallInfra;
