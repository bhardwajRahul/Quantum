import { randomBytes } from 'node:crypto';
import Codespace from '@/modules/codespace/models/Codespace';
import PortBinding from '@/modules/codespace/models/PortBinding';
import DockerContainer from '@/modules/docker/models/DockerContainer';
import DockerImage from '@/modules/docker/models/DockerImage';
import DockerNetwork from '@/modules/docker/models/DockerNetwork';
import ActivityStepContext from '@/modules/activity/services/ActivityStepContext';
import SecretCipher from '@/shared/services/SecretCipher';
import ContainerOps from '../ContainerOps';
import { materializeNetwork } from '../NetworkOps';
import { allocateHostPort } from '../PortAllocator';
import { getContainerStoragePath, getSystemDockerName } from '../paths';
import { failureMessage } from '../failureMessage';
import { CodespaceStatus, PortBindingProtocol } from '@quantum/contracts/modules/codespace/domain';
import { NetworkDriver } from '@quantum/contracts/modules/docker/domain';
import { JobType } from '@quantum/contracts/modules/deployment/domain';
import { logger } from '@/shared/utils/Logger';
import type Job from '../../models/Job';

/** The IDE a codespace runs. It reads `PASSWORD` from the environment and serves on 8080. */
const IDE_IMAGE = { name: 'codercom/code-server', tag: 'latest' };
const IDE_PORT = 8080;

export default class CodespaceHandler{
    async run(job: Job): Promise<void>{
        const codespaceId = job.payload.codespaceId as number | undefined;
        if(codespaceId === undefined) throw new Error('Codespace::Job::MissingCodespaceId');

        if(job.type === JobType.CodespaceDelete){
            await this.#delete(codespaceId);
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
            const network = await activity.step('Preparing the network', () => this.#network(codespace));
            const image = await activity.step('Preparing the image', () => this.#image(codespace));
            const container = await activity.step('Creating the workspace container',
                () => this.#container(codespace, image.id, network.id));

            const { binding, password } = await activity.step('Publishing the workspace',
                () => this.#publish(codespace, container));

            await activity.step('Starting the workspace', () => this.#start(container, password));

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

    async #network(codespace: Codespace): Promise<DockerNetwork>{
        const existing = codespace.networkId === null
            ? null
            : await DockerNetwork.findOneBy({ id: codespace.networkId });
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

    async #container(codespace: Codespace, imageId: number, networkId: number): Promise<DockerContainer>{
        const existing = codespace.containerId === null
            ? null
            : await DockerContainer.findOneBy({ id: codespace.containerId });
        if(existing) return existing;

        const container = await DockerContainer.create({
            name: codespace.name,
            dockerContainerName: '',
            command: '',
            userId: codespace.userId,
            organizationId: codespace.organizationId,
            networkId,
            imageId,
            isRepositoryContainer: false
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

        // Generated once and kept encrypted; the plaintext only leaves through the
        // authorized access endpoint.
        const password = randomBytes(18).toString('base64url');
        codespace.passwordEnc = new SecretCipher().encrypt(password);
        codespace.accessUrl = `http://localhost:${binding.externalPort}`;
        await codespace.save();

        return { binding, password };
    }

    async #start(container: DockerContainer, password: string): Promise<void> {
        const ops = new ContainerOps(container);
        await ops.destroyContainer();
        await ops.createAndStartContainer({ extraEnv: [`PASSWORD=${password}`] });
    }

    async #delete(codespaceId: number): Promise<void>{
        const codespace = await Codespace.findOneBy({ id: codespaceId });
        if(!codespace) return;

        // The container outlives the row unless it is taken down with it.
        if(codespace.containerId !== null){
            const container = await DockerContainer.findOneBy({ id: codespace.containerId });
            if(container) await new ContainerOps(container).removeContainer().catch(() => undefined);
        }

        await codespace.remove();
        logger.info(`codespace ${codespaceId} removed`, { scope: 'orchestrator.handler.codespace' });
    }
}
