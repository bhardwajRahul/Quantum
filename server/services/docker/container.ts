import Dockerode from 'dockerode';
import mongoose from 'mongoose';
import path from 'path';
import slugify from 'slugify';
import PortBinding from '@models/portBinding';
import { Socket } from 'socket.io';
import { ensureDirectoryExists } from '@utilities/helpers';
import { createLogStream, setupSocketEvents, shells } from '@services/logManager';
import { pullImage } from '@services/docker/image';
import { IDockerContainer, FileInfo, ExecResult } from '@typings/models/docker/container';
import { IDockerImage } from '@typings/models/docker/image';
import { IDockerNetwork } from '@typings/models/docker/network';
import { getSystemNetworkName } from '@services/docker/network';
import { IUser } from '@typings/models/user';
import { IRepository } from '@typings/models/repository';
import { IContainerStoragePath } from '@typings/services/dockerContainer';
import { getDockerHost } from '@services/docker/host';
import DockerImage from '@models/docker/image';
import logger from '@utilities/logger';
import DockerNetwork from '@models/docker/network';
import Repository from '@models/repository';
import RepositoryService from '@services/repositoryHandler';
import Github from '@services/github';

const docker = getDockerHost().client();

export const getContainerStoragePath = (userId: string, containerId: string, name: string): IContainerStoragePath => {
    const userContainerPath = path.join('/var/lib/quantum', process.env.NODE_ENV as string, 'containers', userId);
    const containerStoragePath = path.join(userContainerPath, 'docker-containers', `${slugify(name)}-${containerId}`);
    const repositoryContainerPath = path.join(userContainerPath, 'github-repos', `${slugify(name)}-${containerId}`);
    return { userContainerPath, containerStoragePath, repositoryContainerPath };
}

export const getSystemDockerName = (containerId: string): string => {
    const formattedName = containerId.replace(/[^a-zA-Z0-9_.-]/g, '_');
    return `quantum-container-${process.env.NODE_ENV}-${formattedName}`;
}

class DockerContainer{
    private container: IDockerContainer;
    private repository: IRepository | null;

    constructor(container: IDockerContainer){
        this.container = container;
        this.repository = null;
    }

    async getRepository(){
        if(this.repository) return this.repository;
        this.repository = await Repository
            .findById(this.container.repository)
            .populate({
                path: 'user',
                select: 'username',
                populate: { path: 'github', select: 'accessToken username' }
            });
        return this.repository;
    }

    async deployRepository(){
        const repository = await this.getRepository();
        if(!repository) return;
        const repositoryService = new RepositoryService(repository);
        const githubService = new Github(repository.user as IUser, repository);
        await repositoryService.start(githubService);
    }

    async executeCommand(command: string[] | string, options: Partial<Dockerode.ExecOptions> = {}): Promise<ExecResult>{
        const container = await this.getExistingContainer();

        const cmd = typeof command === 'string'
            ? ['sh', '-c', command]
            : command;

        const defaultOptions: Dockerode.ExecOptions = {
            Cmd: cmd,
            AttachStdout: true,
            AttachStderr: true,
            Tty: false,
            ...options
        };

        const exec = await container.exec(defaultOptions);
        const stream = await exec.start({ hijack: true });

        return new Promise<ExecResult>((resolve, reject) => {
            const chunks: Buffer[] = [];
            const errorChunks: Buffer[] = [];

            stream.on('data', (chunk: Buffer) => {
                const data = chunk.slice(8);

                if(chunk[0] === 2) errorChunks.push(data);
                else chunks.push(data);
            });

            stream.on('error', reject);

            stream.on('end', async () => {
                try{
                    const execInspect = await exec.inspect();
                    const output = Buffer.concat(chunks).toString('utf8').trim();
                    const error = Buffer.concat(errorChunks).toString('utf8').trim();
                    resolve({
                        output,
                        exitCode: execInspect.ExitCode,
                        error: error || undefined
                    });
                }catch(error){
                    reject(error);
                }
            });
        });
    };

    async installDefaultPackages(){
        try{
            await this.executeCommand('apk update');
            await this.executeCommand('apk add --no-cache git');
        }catch(error){
            logger.error('@services/docker/container.ts (installDefaultPackages): ' + error);
        }
    }

    async getIpAddress(): Promise<string | null>{
        const container = await this.getExistingContainer();
        const network = await DockerNetwork.findById(this.container.network).select('dockerNetworkName');
        if(!network?.dockerNetworkName){
            return null;
        }
        const data = await container.inspect();

        const networkEntry = data.NetworkSettings?.Networks?.[network.dockerNetworkName];
        return networkEntry?.IPAddress || null;
    }

    async initializeContainer(){
        try{
            const container = await this.getExistingContainer();
            return container;
        }catch(error: any){
            if(error.statusCode === 404){
                const container = await this.createAndStartContainer();
                return container;
            }else{
                logger.error('@services/docker/container.ts (initializeContainer): Could not handle Docker container startup request: ' + error);
            }
        }
    }

    async startSocketShell(socket: Socket, workDir: string = '/app') {
        try{
            const container = await this.initializeContainer();
            if(!container) return;
            const exec = await container.exec({
                Cmd: [this.container.command],
                AttachStdout: true,
                AttachStderr: true,
                AttachStdin: true,
                WorkingDir: workDir,
                Tty: true
            });
            const userId = this.container.user.toString();
            const containerId = this.container._id.toString();
            await createLogStream(userId, containerId);
            setupSocketEvents(socket, userId, containerId, exec);
        }catch(error){
            logger.info('@services/docker/container.ts (startSocketShell): ' + error);
        }
    }

    getDockerStoragePath(): string {
        if(!this.container.storagePath){
            throw Error('The container does not have a storage directory.');
        }
        return this.container.storagePath;
    }

    async getExistingContainer(): Promise<Dockerode.Container> {
        const container = docker.getContainer(this.container.dockerContainerName);
        const { State } = await container.inspect();
        if(!State.Running){

            const desiredState = (this.container as any).desiredState;
            if(desiredState === 'stopped'){
                throw new Error('Container::Stopped::ByUser');
            }
            await container.start();
        }
        return container;
    }

    async getDockerImage(): Promise<IDockerImage> {
        const dockerImage = await DockerImage.findById(this.container.image).select('name tag');
        if(dockerImage === null){
            throw Error("Can't create a container that does not have any images configured.");
        }
        return dockerImage;
    }

    async getPortBindings(): Promise<any>{
        const portBindings = await PortBinding
            .find({ container: this.container._id })
            .select('internalPort externalPort protocol');
        const exposedPorts: any = {};
        const bindings: any = {};
        for(const { internalPort, protocol, externalPort } of portBindings){
            const key = `${internalPort}/${protocol}`;
            exposedPorts[key] = {};
            bindings[key] = [{ HostPort: `${externalPort}` }];
        }
        return { exposedPorts, bindings };
    };

    async getDockerNetwork(): Promise<IDockerNetwork> {
        const dockerNetwork = await DockerNetwork.findById(this.container.network).select('name');
        if(dockerNetwork === null){
            throw Error('Trying to create a container that does not have any network configured yet.');
        }
        return dockerNetwork;
    }

    async writeFile(filePath: string, content: string): Promise<void> {

        const b64 = Buffer.from(content, 'utf8').toString('base64');
        await this.executeCommand(
            ['sh', '-c', 'mkdir -p "$(dirname "$1")" && printf %s "$2" | base64 -d > "$1"', 'quantum-write', filePath, b64]
        );
    }

    async readFile(filePath: string): Promise<string> {
        const { output, exitCode, error } = await this.executeCommand(['cat', filePath]);

        if(exitCode !== 0){
            throw new Error(`Failed to read file ${filePath}: ${error}`);
        }

        return output;
    }

    async listDirectory(dirPath: string = '/'): Promise<FileInfo[]>{
        const { output, exitCode, error } = await this.executeCommand(['ls', '-la', dirPath]);

        if(exitCode !== 0){
            throw new Error(`Failed to list directory ${dirPath}: ${error}`);
        }

        return this.parseLsOutput(output);
    }

    private parseLsOutput(output: string): FileInfo[]{
        const lines = output
            .split('\n')
            .filter(line => line.trim().length > 0)
            .filter(line => !line.startsWith('total'));
        return lines
            .map(line => {
                const match = line.match(/^([d\-])[\w-]+ +\d+ +\w+ +\w+ +\d+ +\w+ +\d+ +[\d:]+ +(.+)$/);
                if(!match || line.length < 10) return null;

                const name = match[2].trim();
                if(name === '.' || name === '..') return null;

                return {
                    name,
                    isDirectory: match[1] === 'd'
                };
            })
            .filter((file): file is FileInfo =>
                file !== null &&
                file.name !== '' &&
                file.name.length > 0
            );
    }

    async getContainerVolumes(): Promise<string[]> {
        if(!(this.container.volumes && this.container.volumes.length > 0)){
            return [];
        }
        const volumes: string[] = [];
        for(const { containerPath, mode } of this.container.volumes){
            const volumeName = `${this.container.dockerContainerName}-${slugify(containerPath)}`;
            try{

                await docker.createVolume({
                    Name: volumeName,
                    Labels: {
                        container: this.container.dockerContainerName,
                    },
                });
            }catch(error: any){
                if(error.statusCode !== 409){
                    throw error;
                }
            }
            volumes.push(`${volumeName}:${containerPath}:${mode.trim()}`);
        }
        return volumes;
    }

    async getDockerOptions(overrides: { imageOverride?: string; extraLabels?: Record<string, string>; resources?: { nanoCpus?: number; memoryBytes?: number; storageSize?: string } } = {}){
        const dockerImage = await this.getDockerImage();
        const dockerNetwork = await this.getDockerNetwork();
        const networkName = getSystemNetworkName(this.container.user.toString(), dockerNetwork._id.toString());
        const { exposedPorts, bindings } = await this.getPortBindings();
        const volumeMounts: string[] = await this.getContainerVolumes();
        const binds = this.container.isRepositoryContainer ? [`${this.getDockerStoragePath()}:/app:rw`] : undefined;
        const environmentVariables = Array.from(this.container.environment.variables.entries()).map(
            ([key, value]) => `${key}=${value}`
        );

        const options: any = {

            Image: overrides.imageOverride || `${dockerImage.name}:${dockerImage.tag}`,
            name: this.container.dockerContainerName,
            Tty: true,
            OpenStdin: true,
            StdinOnce: true,
            Env: environmentVariables,
            ExposedPorts: exposedPorts,
            HostConfig: {
                PortBindings: bindings,
                Binds: binds,
                Mounts: volumeMounts.map((volume) => {
                    const [Source, Target, Mode] = volume.split(':');
                    return {
                        Source,
                        Target,
                        Type: 'volume',
                        ReadOnly: Mode === 'ro',
                    };
                }),
                NetworkMode: networkName,
                RestartPolicy: { Name: 'always' },
            },
        };

        if(overrides.resources){
            const { nanoCpus, memoryBytes, storageSize } = overrides.resources;
            if(nanoCpus) options.HostConfig.NanoCpus = nanoCpus;
            if(memoryBytes){
                options.HostConfig.Memory = memoryBytes;
                options.HostConfig.MemorySwap = memoryBytes;
            }
            if(storageSize) options.HostConfig.StorageOpt = { size: storageSize };
        }

        if(overrides.extraLabels && Object.keys(overrides.extraLabels).length > 0){
            options.Labels = { ...(options.Labels || {}), ...overrides.extraLabels };
        }

        return options;
    }

    async createContainer(overrides: { imageOverride?: string; extraLabels?: Record<string, string>; resources?: { nanoCpus?: number; memoryBytes?: number; storageSize?: string } } = {}): Promise<Dockerode.Container> {
        const options = await this.getDockerOptions(overrides);
        const container = await docker.createContainer(options);
        return container;
    }

    async reloadContainer(reloadOverrides: { extraLabels?: Record<string, string>; imageOverride?: string } = {}): Promise<void>{
        try{
            await this.container.updateOne({ status: 'reloading' });
            shells.delete(this.container._id.toString());
            const containerName = this.container.dockerContainerName;
            const container = docker.getContainer(containerName);
            const containerInfo = await container.inspect();
            const isRunning = containerInfo.State.Running;
            if(isRunning){
                await container.stop({ t: 10 });
                logger.info(`@services/docker/container.ts (reloadContainer): Stopped container ${containerName} for environment update`);
            }

            const tempImageName = `temp-${containerName}-${Date.now()}`;
            await container.commit({ repo: tempImageName });
            logger.info(`@services/docker/container.ts (reloadContainer): Created temporary image of container ${containerName}`);
            try{
                const existingBinds = containerInfo.HostConfig.Binds || [];
                const existingVolumes = (containerInfo.Mounts || [])
                    .filter((mount) => mount.Type === 'volume')
                    .map((mount) => ({
                        Source: mount.Name,
                        Target: mount.Destination,
                        Type: 'volume',
                        ReadOnly: mount.RW === false
                    }));
                await container.remove({ force: true, v: false });
                logger.info(`@services/docker/container.ts (reloadContainer): Removed old container ${containerName} without removing volumes`);

                const newOptions = await this.getDockerOptions({ extraLabels: reloadOverrides.extraLabels });
                if(!newOptions.HostConfig.Binds && existingBinds.length > 0){
                    newOptions.HostConfig.Binds = existingBinds;
                }

                if(!newOptions.HostConfig.Mounts && existingVolumes.length > 0){
                    newOptions.HostConfig.Mounts = existingVolumes;
                }

                newOptions.Image = reloadOverrides.imageOverride || tempImageName;
                const newContainer = await docker.createContainer({
                    ...newOptions,
                    name: containerName
                });

                if(isRunning){
                    await newContainer.start();
                    await this.container.updateOne({ status: 'running' });
                    logger.info(`@services/docker/container.ts (reloadContainer): Started recreated container ${containerName} with updated environment`);

                    await this.relaunchRepositoryApp();
                }else{
                    await this.container.updateOne({ status: 'stopped' });
                    logger.info(`@services/docker/container.ts (reloadContainer): Created container ${containerName} with updated environment (not started)`);
                }
                await this.container.updateOne({ status: 'running' });
                logger.info(`@services/docker/container.ts (reloadContainer): Successfully reloaded container ${containerName}`);
            }finally{

                await docker.getImage(tempImageName).remove({ force: true })
                    .then(() => logger.info(`@services/docker/container.ts (reloadContainer): Removed temporary image ${tempImageName}`))
                    .catch((err) => logger.warn(`@services/docker/container.ts (reloadContainer): could not remove temp image ${tempImageName}: ${err}`));
            }
        }catch(error){
            logger.error(`@services/docker/container.ts (reloadContainer): ${error}`);
            await this.container.updateOne({ status: 'error' });
            throw error;
        }
    }

    async relaunchRepositoryApp(): Promise<void>{
        if(!this.container.isRepositoryContainer) return;
        try{
            const repository = await Repository.findById(this.container.repository)
                .select('startCommand rootDirectory deployments');
            const startCommand = repository?.startCommand;
            if(!repository || !startCommand) return;
            const workingDir = '/app' + (repository.rootDirectory || '');

            const Deployment = mongoose.model('Deployment');
            const currentDeploymentId = repository.deployments?.slice(-1)[0];
            const deployment = currentDeploymentId
                ? await Deployment.findById(currentDeploymentId).select('environment')
                : null;
            const envArray: string[] = deployment && typeof (deployment as any).getEnvironmentArray === 'function'
                ? (deployment as any).getEnvironmentArray()
                : [];

            this.executeCommand(['sh', '-c', `${startCommand} &`], { WorkingDir: workingDir, Env: envArray } as any)
                .catch(() => {});
            logger.info(`@services/docker/container.ts (relaunchRepositoryApp): re-launched start command for ${this.container.dockerContainerName}`);
        }catch(error){
            logger.warn(`@services/docker/container.ts (relaunchRepositoryApp): ${error}`);
        }
    }

    async updateResourceLimits(nanoCpus: number, memoryBytes: number): Promise<void>{
        const container = docker.getContainer(this.container.dockerContainerName);
        await container.update({
            NanoCpus: nanoCpus,
            Memory: memoryBytes,
            MemorySwap: memoryBytes
        } as any);
        logger.info(`@services/docker/container.ts (updateResourceLimits): applied NanoCpus=${nanoCpus} Memory=${memoryBytes} to ${this.container.dockerContainerName}`);
    }

    async removeContainer(){
        const container = docker.getContainer(this.container.dockerContainerName);
        const containerInfo = await container.inspect().catch((err) => {
            if(err.statusCode === 404){
                return null;
            }
            throw err;
        });
        if(containerInfo){
            await container.remove({ force: true }).catch((err: any) => {

                if(err?.statusCode === 404) return;
                throw err;
            });
        }
        if(this.container.volumes){
            for(const { containerPath } of this.container.volumes){
                const volumeName = `${this.container.dockerContainerName}-${slugify(containerPath)}`;
                try{
                    const volume = docker.getVolume(volumeName);
                    await volume.remove();
                }catch(error: any){
                    if(error.statusCode !== 404){
                        logger.warn(
                            `@services/docker/container.ts (removeContainer): Could not remove volume ${volumeName}. Error: ${error}`
                        );
                    }
                }
            }
        }
    }

    async stop(): Promise<void>{
        try{
            const container = docker.getContainer(this.container.dockerContainerName);

            await container.stop({ t: 10 });
            await this.container.updateOne({ status: 'stopped' });
            logger.info(`@services/docker/container.ts (stopContainer): Successfully stopped container ${this.container.dockerContainerName}.`);
        }catch(error){
            logger.error(`@services/docker/container.ts (stopContainer): Failed to stop container ${this.container.dockerContainerName}. Error: ${error}`);
            throw error;
        }
    }

    async restart(): Promise<void>{
        try{
            const container = docker.getContainer(this.container.dockerContainerName);
            logger.info(`@services/docker/container.ts (restartContainer): Restarting container ${this.container.dockerContainerName}...`);
            await this.container.updateOne({ status: 'restarting' });
            await container.restart({ t: 10 });

            if(this.container.isRepositoryContainer){
                await this.relaunchRepositoryApp();
            }
            await this.container.updateOne({ status: 'running' });
            logger.info(`@services/docker/container.ts (restartContainer): Successfully restarted container ${this.container.dockerContainerName}.`);
        }catch(error){
            logger.error(`@services/docker/container.ts (restartContainer): Failed to restart container ${this.container.dockerContainerName}. Error: ${error}`);
            throw error;
        }
    }

    async start(): Promise<void>{
        try{
            const container = docker.getContainer(this.container.dockerContainerName);
            const { State } = await container.inspect();
            if(State.Running){
                logger.info(`@services/docker/container.ts (startContainer): Container ${this.container.dockerContainerName} is already running.`);
                return;
            }
            await container.start();
            if(this.container.isRepositoryContainer){
                await this.installDefaultPackages();
                await this.deployRepository();
            }
            await this.container.updateOne({ status: 'running' });
            logger.info(`@services/docker/container.ts (startContainer): Successfully started container ${this.container.dockerContainerName}.`);
        }catch(error){
            logger.error(`@services/docker/container.ts (startContainer): Failed to start container ${this.container.dockerContainerName}. Error: ${error}`);
            throw error;
        }
    }

    async createAndStartContainer(overrides: { imageOverride?: string; extraLabels?: Record<string, string>; resources?: { nanoCpus?: number; memoryBytes?: number; storageSize?: string } } = {}): Promise<Dockerode.Container> {
        const dockerImage = await this.getDockerImage();

        if(!overrides.imageOverride){
            await pullImage(dockerImage.name, dockerImage.tag);
        }
        await ensureDirectoryExists(this.getDockerStoragePath());
        const container = await this.createContainer(overrides);
        await container.start();
        if(this.container.isRepositoryContainer){
            await this.installDefaultPackages();
        }
        await this.container.updateOne({ status: 'running' });
        return container;
    }
}

export default DockerContainer;

export const materializeContainer = async (doc: IDockerContainer): Promise<void> => {
    const fresh = await mongoose.model('DockerContainer').findById(doc._id) as IDockerContainer | null;
    if(!fresh){
        logger.error('@services/docker/container.ts (materializeContainer): container doc vanished before materialize: ' + doc._id);
        return;
    }
    const service = new DockerContainer(fresh);
    await service.createAndStartContainer();
    const ipAddress = await service.getIpAddress();
    if(ipAddress){
        await mongoose.model('DockerContainer').updateOne({ _id: fresh._id }, { ipAddress });
    }

    const push = { $push: { containers: fresh._id } };
    await mongoose.model('User').updateOne({ _id: fresh.user }, push);
    await DockerImage.updateOne({ _id: fresh.image }, push);
    await DockerNetwork.updateOne({ _id: fresh.network }, push);
};

export const teardownContainer = async (doc: IDockerContainer): Promise<void> => {
    if(!doc) return;
    await new DockerContainer(doc).removeContainer();
};