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
                // Docker multiplexes streams; header byte 2 = stderr, otherwise stdout.
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
        // The container may be running but unattached from its declared network
        // (e.g. the network failed to materialize). Don't throw — return null and
        // let the caller continue without an IP rather than crashing the deploy.
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
        if(!State.Running) await container.start();
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
        // Inject-safe write: the dynamic values (filePath, content) are passed as
        // POSITIONAL ARGS to `sh -c` (so they are never part of the script text),
        // and content is base64-encoded (base64 alphabet is shell-safe).
        // `sh -c SCRIPT name arg1 arg2` sets $0=name, $1=arg1, $2=arg2.
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
                // REMOVE RW FROM DB
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
            // imageOverride lets a deploy run an EXACT immutable build artifact tag
            // (Phase 3 build-strategies) instead of the configured DockerImage doc.
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

        // Hard resource limits (Codespaces: configurable CPU/RAM/disk). NanoCpus =
        // cores * 1e9; Memory in bytes. storageSize maps to the per-container disk
        // quota via the storage driver's StorageOpt.size (requires a quota-capable
        // driver, e.g. overlay2 on xfs with pquota — advisory/no-op otherwise).
        if(overrides.resources){
            const { nanoCpus, memoryBytes, storageSize } = overrides.resources;
            if(nanoCpus) options.HostConfig.NanoCpus = nanoCpus;
            if(memoryBytes){
                options.HostConfig.Memory = memoryBytes;
                options.HostConfig.MemorySwap = memoryBytes; // disable swap beyond the limit
            }
            if(storageSize) options.HostConfig.StorageOpt = { size: storageSize };
        }

        // extraLabels carry Traefik ingress routing rules (Phase 3 ingress), applied
        // on (re)create so routing follows the container through redeploys.
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

    async reloadContainer(): Promise<void>{
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

            const newOptions = await this.getDockerOptions();
            if(!newOptions.HostConfig.Binds && existingBinds.length > 0){
                newOptions.HostConfig.Binds = existingBinds;
            }

            if(!newOptions.HostConfig.Mounts && existingVolumes.length > 0){
                newOptions.HostConfig.Mounts = existingVolumes;
            }

            newOptions.Image = tempImageName;
            const newContainer = await docker.createContainer({
                ...newOptions,
                name: containerName
            });

            if(isRunning){
                await newContainer.start();
                await this.container.updateOne({ status: 'running' });
                logger.info(`@services/docker/container.ts (reloadContainer): Started recreated container ${containerName} with updated environment`);
                // A repository container runs its app via a backgrounded start command
                // (exec strategy) — recreating the container loses that process, so
                // re-launch it. Without this, any reload (env/port change) leaves the
                // container up but the app dead.
                await this.relaunchRepositoryApp();
            }else{
                await this.container.updateOne({ status: 'stopped' });
                logger.info(`@services/docker/container.ts (reloadContainer): Created container ${containerName} with updated environment (not started)`);
            }

            const tempImage = docker.getImage(tempImageName);
            await tempImage.remove({ force: true });
            logger.info(`@services/docker/container.ts (reloadContainer): Removed temporary image ${tempImageName}`);
            await this.container.updateOne({ status: 'running' });
            logger.info(`@services/docker/container.ts (reloadContainer): Successfully reloaded container ${containerName}`);
        }catch(error){
            logger.error(`@services/docker/container.ts (reloadContainer): ${error}`);
            await this.container.updateOne({ status: 'error' });
            throw error;
        }
    }
    
    /**
     * Re-launch a repository app's start command inside this container. The exec
     * build strategy runs the app as a backgrounded `sh -c "<startCommand> &"`
     * process (RepositoryHandler.start) — it is NOT the container's CMD, so a
     * recreate (reload, reconcile self-heal) leaves the container up but the app
     * dead. This restarts it from the deployment's env + the repo's startCommand,
     * using the SAME injection-safe argv form as the deploy path. Best-effort: a
     * repo without a start command (e.g. static) or without a deployment is a no-op.
     */
    async relaunchRepositoryApp(): Promise<void>{
        if(!this.container.isRepositoryContainer) return;
        try{
            const repository = await Repository.findById(this.container.repository)
                .select('startCommand rootDirectory deployments');
            const startCommand = repository?.startCommand;
            if(!repository || !startCommand) return;
            const workingDir = '/app' + (repository.rootDirectory || '');
            // Reuse the latest deployment's env snapshot, mirroring RepositoryHandler.start.
            const Deployment = mongoose.model('Deployment');
            const currentDeploymentId = repository.deployments?.slice(-1)[0];
            const deployment = currentDeploymentId
                ? await Deployment.findById(currentDeploymentId).select('environment')
                : null;
            const envArray: string[] = deployment && typeof (deployment as any).getEnvironmentArray === 'function'
                ? (deployment as any).getEnvironmentArray()
                : [];
            // Backgrounded (`&`) like the deploy path; don't await the process.
            this.executeCommand(['sh', '-c', `${startCommand} &`], { WorkingDir: workingDir, Env: envArray } as any)
                .catch(() => {});
            logger.info(`@services/docker/container.ts (relaunchRepositoryApp): re-launched start command for ${this.container.dockerContainerName}`);
        }catch(error){
            logger.warn(`@services/docker/container.ts (relaunchRepositoryApp): ${error}`);
        }
    }

    /**
     * Apply HARD resource limits to the LIVE container without recreating it
     * (Codespaces: configurable CPU/RAM). NanoCpus = cores * 1e9; Memory in bytes.
     * MemorySwap is pinned to Memory to disable swap beyond the cap. Some daemons
     * reject live cpu/memory updates (e.g. no swap-limit cgroup support) — callers
     * wrap this in try/catch and continue.
     */
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
        try{
            const container = docker.getContainer(this.container.dockerContainerName);
            const containerInfo = await container.inspect().catch((err) => {
                if(err.statusCode === 404){
                    return null;
                } 
                throw err;
            });
            if(containerInfo){
                await container.remove({ force: true });
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
        }catch(error){
            logger.error('@services/docker/container.ts (removeContainer): ' + error);
        }
    }

    async stop(): Promise<void>{
        try{
            const container = docker.getContainer(this.container.dockerContainerName);
            await container.stop({ t: 0 });
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
            await container.restart({ });
            logger.info(`@services/docker/container.ts (restartContainer): Stopped container ${this.container.dockerContainerName}.`);
            if(this.container.isRepositoryContainer){
                await this.installDefaultPackages();
                await this.deployRepository();
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

    async createAndStartContainer(overrides: { imageOverride?: string; extraLabels?: Record<string, string>; resources?: { nanoCpus?: number; memoryBytes?: number; storageSize?: string } } = {}): Promise<Dockerode.Container | null> {
        try{
            const dockerImage = await this.getDockerImage();
            // When running an immutable build artifact, the tag already exists
            // locally (built/pulled by the build job) — only pull the base image
            // for the non-artifact path.
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
        }catch(error){
            logger.error('@services/docker/container.ts (createAndStartContainer): ' + error);
            return null;
        }
    }
}

export default DockerContainer;

/**
 * Create + start the REAL Docker container for an already-persisted
 * DockerContainer doc, then persist the runtime fields (ipAddress) and the
 * back-references the rest of the code relies on. This is the relocation of the
 * side effects that used to live in DockerContainer.pre('save') — moved out of
 * the model so persistence is pure and the service layer owns Docker I/O
 * (ADR-0001). Callers that need the container running synchronously (deploy,
 * provisioners) await this right after `.create()`.
 *
 * IMPORTANT: the doc is re-loaded via findById (NOT lean) so the post('findOne')
 * decrypt hook yields PLAINTEXT env vars. `.create()` returns a doc whose env is
 * already encrypted (the pre('save') encrypt block runs, and there is no
 * post('save') decrypt hook), so building Docker options from the passed-in doc
 * would inject ciphertext into the container.
 */
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
    // Back-references previously maintained inside the model hook.
    const push = { $push: { containers: fresh._id } };
    await mongoose.model('User').updateOne({ _id: fresh.user }, push);
    await DockerImage.updateOne({ _id: fresh.image }, push);
    await DockerNetwork.updateOne({ _id: fresh.network }, push);
};

/**
 * Remove the REAL Docker container (and its volumes) for a deleted DockerContainer
 * doc. Relocation of the daemon teardown that used to live in the model's
 * delete hooks (ADR-0001) — callers (HTTP deleteOne interceptor, org/user cascade)
 * run this explicitly. The DB ref-cascade ($pull) stays in the model hook.
 */
export const teardownContainer = async (doc: IDockerContainer): Promise<void> => {
    if(!doc) return;
    await new DockerContainer(doc).removeContainer();
};