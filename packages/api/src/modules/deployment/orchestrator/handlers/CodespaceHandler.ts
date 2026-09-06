import { randomBytes } from 'node:crypto';
import { In } from 'typeorm';
import Codespace from '@/modules/codespace/models/Codespace';
import PortBinding from '@/modules/docker/models/PortBinding';
import DockerContainer from '@/modules/docker/models/DockerContainer';
import DockerImage from '@/modules/docker/models/DockerImage';
import DockerNetwork from '@/modules/docker/models/DockerNetwork';
import TemplateInstall from '@/modules/template/models/TemplateInstall';
import ActivityStepContext from '@/modules/activity/services/ActivityStepContext';
import SecretCipher from '@/shared/services/SecretCipher';
import { installWorkspace, repositoryWorkspace, WORKSPACE_ROOT } from '@/modules/codespace/services/workspaceMounts';
import ContainerOps from '../ContainerOps';
import { materializeNetwork, teardownNetwork } from '../NetworkOps';
import { allocateHostPort } from '../PortAllocator';
import { getContainerStoragePath, getSystemDockerName } from '../paths';
import { publicHost } from '../publicHost';
import { failureMessage } from '../failureMessage';
import { CodespaceStatus } from '@quantum/contracts/modules/codespace/domain';
import { NetworkDriver, PortBindingProtocol } from '@quantum/contracts/modules/docker/domain';
import { JobType } from '@quantum/contracts/modules/deployment/domain';
import { logger } from '@/shared/utils/Logger';
import type { DockerContainerVolume } from '@quantum/contracts/modules/docker/domain';
import type Job from '../../models/Job';

const IDE_IMAGE = { name: 'codercom/code-server', tag: 'latest' };
const IDE_PORT = 8080;
const ROOT_USER = '0';

interface Workspace{
    networkId: number | null;
    volumes: DockerContainerVolume[];
}

export default class CodespaceHandler{
    async run(job: Job): Promise<void>{
        const codespaceId = job.payload.codespaceId as number | undefined;
        if(codespaceId === undefined) throw new Error('Codespace::Job::MissingCodespaceId');

        if(job.type === JobType.CodespaceDelete){
            await this.#delete(codespaceId, job.payload.containerId as number | null | undefined, job.payload.networkId as number | null | undefined);
            return;
        }
        if(job.type === JobType.CodespaceProvision){
            await this.#provision(job, codespaceId);
            return;
        }
        throw new Error(`Codespace::Job::UnknownType::${job.type}`);
    }

    /**
     * Provisions the codespace for real.
     *
     * This used to set the status to `provisioning`, log that the container backend was
     * "deferred", and report the job as completed — so a codespace sat in provisioning
     * for ever, with nothing in the activity feed to say why, because the handler never
     * recorded a step either.
     */
    async #provision(job: Job, codespaceId: number): Promise<void>{
        const codespace = await Codespace.findOneBy({ id: codespaceId });
        if(!codespace) throw new Error(`Codespace::Job::NotFound::${codespaceId}`);

        const activity = new ActivityStepContext({
            organizationId: codespace.organizationId,
            userId: job.userId ?? codespace.userId,
            scope: 'codespace',
            source: 'orchestrator.codespace',
            correlationId: String(job.id)
        });

        codespace.status = CodespaceStatus.Provisioning;
        await codespace.save();

        try{
            const workspace = await this.#workspace(codespace);
            const network = await activity.step('Preparing the network', () => this.#network(codespace, workspace.networkId));
            const image = await activity.step('Preparing the image', () => this.#image(codespace));
            const container = await activity.step('Creating the workspace container',
                () => this.#container(codespace, image.id, network.id, workspace.volumes));

            const { binding, password } = await activity.step('Publishing the workspace',
                () => this.#publish(codespace, container));

            await activity.step('Starting the workspace', () => this.#start(container, password, workspace.volumes.length > 0));

            codespace.imageId = image.id;
            codespace.networkId = network.id;
            codespace.containerId = container.id;
            codespace.portBindingId = binding.id;
            codespace.status = CodespaceStatus.Running;
            await codespace.save();

            await activity.success(`Workspace ready on port ${binding.externalPort}`);
            logger.info(`codespace ${codespaceId} running on host port ${binding.externalPort}`,
                { scope: 'orchestrator.handler.codespace' });
        }catch(error){
            /*
             * The status has to land on `error`, not stay on `provisioning`. A failed
             * provision that leaves the row mid-flight is indistinguishable from one still
             * in progress, which is exactly how this looked from the outside.
             */
            codespace.status = CodespaceStatus.Error;
            await codespace.save();
            await activity.fail('Provisioning failed', failureMessage(error));
            throw error;
        }
    }

    async #workspace(codespace: Codespace): Promise<Workspace>{
        if(codespace.repositoryId !== null){
            const container = await DockerContainer.findOneBy({ repositoryId: codespace.repositoryId });
            if(!container?.storagePath) throw new Error(`Codespace::Target::NotDeployed::repository:${codespace.repositoryId}`);
            return { networkId: container.networkId, volumes: repositoryWorkspace(container.storagePath) };
        }

        if(codespace.templateInstallId !== null){
            const install = await TemplateInstall.findOneBy({ id: codespace.templateInstallId });
            if(!install) throw new Error(`Codespace::Target::NotDeployed::install:${codespace.templateInstallId}`);

            const ids = install.services.map((service) => service.containerId).filter((id): id is number => id !== null);
            const containers = ids.length === 0 ? [] : await DockerContainer.findBy({ id: In(ids) });
            const services = install.services.flatMap((service) => {
                const container = containers.find((entry) => entry.id === service.containerId);
                return container ? [{ name: service.name, container }] : [];
            });
            return { networkId: install.networkId, volumes: installWorkspace(services) };
        }

        return { networkId: null, volumes: [] };
    }

    async #network(codespace: Codespace, targetNetworkId: number | null): Promise<DockerNetwork>{
        const wanted = targetNetworkId ?? codespace.networkId;
        const existing = wanted === null ? null : await DockerNetwork.findOneBy({ id: wanted });
        if(existing) return existing;

        const network = await DockerNetwork.create({
            name: `codespace-${codespace.id}`,
            dockerNetworkName: '',
            driver: NetworkDriver.Bridge,
            userId: codespace.userId,
            organizationId: codespace.organizationId
        }).save();

        network.dockerNetworkName = `quantum-network-${network.id}`;
        await network.save();
        await materializeNetwork(network);
        return network;
    }

    async #image(codespace: Codespace): Promise<DockerImage>{
        const existing = await DockerImage.findOneBy({
            name: IDE_IMAGE.name,
            tag: IDE_IMAGE.tag,
            organizationId: codespace.organizationId,
            userId: codespace.userId
        });
        if(existing) return existing;

        return DockerImage.create({
            ...IDE_IMAGE,
            userId: codespace.userId,
            organizationId: codespace.organizationId
        }).save();
    }

    async #container(codespace: Codespace, imageId: number, networkId: number, volumes: DockerContainerVolume[]): Promise<DockerContainer>{
        const existing = codespace.containerId === null
            ? null
            : await DockerContainer.findOneBy({ id: codespace.containerId });
        if(existing){
            existing.networkId = networkId;
            existing.volumes = volumes;
            await existing.save();
            return existing;
        }

        const container = await DockerContainer.create({
            name: codespace.name,
            dockerContainerName: '',
            command: '',
            userId: codespace.userId,
            organizationId: codespace.organizationId,
            networkId,
            imageId,
            isRepositoryContainer: false,
            volumes
        }).save();

        container.dockerContainerName = getSystemDockerName(container.id);
        container.storagePath = getContainerStoragePath(
            codespace.userId, container.id, codespace.name
        ).containerStoragePath;
        await container.save();
        return container;
    }

    async #publish(codespace: Codespace, container: DockerContainer): Promise<{ binding: PortBinding; password: string }>{
        const existing = await PortBinding.findOneBy({ containerId: container.id, internalPort: IDE_PORT });
        const binding = existing ?? await PortBinding.create({
            containerId: container.id,
            userId: codespace.userId,
            organizationId: codespace.organizationId,
            internalPort: IDE_PORT,
            externalPort: await allocateHostPort(),
            protocol: PortBindingProtocol.Tcp
        }).save();

        const password = randomBytes(18).toString('base64url');
        codespace.passwordEnc = new SecretCipher().encrypt(password);
        codespace.accessUrl = `http://${publicHost()}:${binding.externalPort}/?folder=${WORKSPACE_ROOT}`;
        await codespace.save();

        return { binding, password };
    }

    async #start(container: DockerContainer, password: string, editsApplicationFiles: boolean): Promise<void>{
        const ops = new ContainerOps(container);
        await ops.destroyContainer();
        await ops.createAndStartContainer({
            extraEnv: [`PASSWORD=${password}`],
            user: editsApplicationFiles ? ROOT_USER : undefined
        });
    }

    async #delete(codespaceId: number, containerId?: number | null, networkId?: number | null): Promise<void>{
        const codespace = await Codespace.findOneBy({ id: codespaceId });
        const wantedContainer = containerId ?? codespace?.containerId ?? null;
        const container = wantedContainer === null ? null : await DockerContainer.findOneBy({ id: wantedContainer });
        if(container){
            await new ContainerOps(container).removeContainer().catch(() => undefined);
            await PortBinding.delete({ containerId: container.id });
            await container.remove();
        }

        const wantedNetwork = networkId ?? codespace?.networkId ?? null;
        const network = wantedNetwork === null ? null : await DockerNetwork.findOneBy({ id: wantedNetwork });
        if(network && network.name === `codespace-${codespaceId}`){
            await teardownNetwork(network).catch(() => undefined);
            await network.remove();
        }

        if(codespace) await codespace.remove();
        logger.info(`codespace ${codespaceId} removed`, { scope: 'orchestrator.handler.codespace' });
    }
}
