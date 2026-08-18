import crypto from 'crypto';
import http from 'http';
import { v4 } from 'uuid';
import Codespace from '@models/codespace';
import DockerContainer from '@models/docker/container';
import DockerImage from '@models/docker/image';
import DockerNetwork from '@models/docker/network';
import PortBinding from '@models/portBinding';
import DockerContainerService, { materializeContainer } from '@services/docker/container';
import { pullImage, createAndMaterializeImage } from '@services/docker/image';
import { createAndMaterializeNetwork } from '@services/docker/network';
import { connectContainerToEdge } from '@services/ingress';
import { encrypt } from '@utilities/encryption';
import { findRandomAvailablePort } from '@utilities/helpers';
import logger from '@utilities/logger';
import { ICodespace } from '@typings/models/codespace';
import { IDockerContainer } from '@typings/models/docker/container';
import { ActivityReporter } from '@typings/services/activity';

const CODE_SERVER_IMAGE = 'codercom/code-server';
const CODE_SERVER_TAG = 'latest';
const CODE_SERVER_PORT = 8080;

const loadWithSecret = (codespaceId: string) =>
    Codespace.findById(codespaceId).select('+passwordEnc');

const waitForReadiness = async (externalPort: number): Promise<void> => {
    const host = process.env.SERVER_IP || '127.0.0.1';
    const attempts = Number(process.env.CODESPACE_READINESS_ATTEMPTS) || 30;
    const delayMs = Number(process.env.CODESPACE_READINESS_DELAY_MS) || 2000;
    for(let attempt = 1; attempt <= attempts; attempt++){
        const ok = await new Promise<boolean>((resolve) => {
            const req = http.get({ host, port: externalPort, path: '/healthz', timeout: 2000 }, (res) => {
                res.resume();
                resolve(true);
            });
            req.on('error', () => resolve(false));
            req.on('timeout', () => { req.destroy(); resolve(false); });
        });
        if(ok) return;
        await new Promise((resolve) => setTimeout(resolve, delayMs));
    }
    logger.warn(`@services/codespace/provisioner.ts (waitForReadiness): code-server on :${externalPort} not confirmed ready — continuing.`);
};

export const provisionCodespace = async (codespaceId: string, act: ActivityReporter): Promise<ICodespace> => {
    const doc = (await loadWithSecret(codespaceId)) as ICodespace;
    if(!doc) throw new Error(`Codespace::Provision::NotFound::${codespaceId}`);

    doc.status = 'provisioning';
    await doc.save();

    try{
        const ownerId = doc.user?.toString();
        const organizationId = doc.organization;

        await act.step('Pulling code-server image', () => pullImage(CODE_SERVER_IMAGE, CODE_SERVER_TAG));
        let image = await DockerImage.findOne({
            name: CODE_SERVER_IMAGE,
            tag: CODE_SERVER_TAG,
            organization: organizationId
        });
        if(!image){
            image = await createAndMaterializeImage({
                name: CODE_SERVER_IMAGE,
                tag: CODE_SERVER_TAG,
                user: ownerId,
                organization: organizationId
            });
        }

        const network = await act.step('Creating network', () => createAndMaterializeNetwork({
            name: `cs-${v4().slice(0, 8)}`,
            user: ownerId,
            organization: organizationId
        }));

        const password = crypto.randomBytes(18).toString('base64url');
        const containerName = `codespace-${doc.name}-${v4().slice(0, 4)}`
            .toLowerCase()
            .replace(/[^a-z0-9_.-]/g, '-');
        const container = await act.step('Starting codespace container', async () => {
            const created = await DockerContainer.create({
                user: ownerId,
                organization: organizationId,
                image: image._id,
                network: network._id,
                name: containerName,
                volumes: [{ containerPath: '/home/coder', mode: 'rw' }],
                environment: { variables: new Map<string, string>([['PASSWORD', password]]) }
            });
            await materializeContainer(created as unknown as IDockerContainer);

            return await DockerContainer.findById(created._id) as IDockerContainer;
        });

        act.progress('Applying resource limits');
        try{
            const service = new DockerContainerService(container);
            await service.updateResourceLimits(
                (doc.cpuCores || 1) * 1e9,
                (doc.memoryMb || 2048) * 1024 * 1024
            );
        }catch(error){
            logger.warn(`@services/codespace/provisioner.ts (provisionCodespace): live resource update rejected for ${container.dockerContainerName}: ${error}`);
        }

        await act.step('Connecting to edge network', () => connectContainerToEdge(doc.nodeId || 'local', container.dockerContainerName));

        const externalPort = await findRandomAvailablePort();
        if(externalPort === -1){
            throw new Error('Codespace::Provision::NoAvailablePort');
        }
        const portBinding = await act.step('Binding port', () => PortBinding.create({
            container: container._id,
            user: ownerId,
            organization: organizationId,
            internalPort: CODE_SERVER_PORT,
            externalPort,
            protocol: 'tcp'
        }));
        await act.step('Publishing port', () => new DockerContainerService(container as IDockerContainer).reloadContainer());

        await act.step('Waiting for readiness', () => waitForReadiness(externalPort));

        doc.image = image._id as any;
        doc.network = network._id as any;
        doc.container = container._id as any;
        doc.portBinding = portBinding._id as any;
        doc.accessUrl = `http://${process.env.SERVER_IP}:${externalPort}`;
        doc.passwordEnc = encrypt(password);
        doc.status = 'running';
        await act.step('Finalizing codespace', () => doc.save());

        logger.info(`@services/codespace/provisioner.ts (provisionCodespace): provisioned codespace ${doc._id} on :${externalPort}`);
        return doc;
    }catch(error){
        doc.status = 'error';
        await doc.save().catch(() => undefined);
        logger.error('@services/codespace/provisioner.ts (provisionCodespace): ' + error);
        throw error;
    }
};

export default { provisionCodespace };
