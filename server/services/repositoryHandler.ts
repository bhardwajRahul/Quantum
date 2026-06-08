import Deployment from '@models/deployment';
import logger from '@utilities/logger';
import { IRepository } from '@typings/models/repository';
import GithubService from '@services/github';
import DockerContainerService from '@services/docker/container';
import DockerContainer from '@models/docker/container';
import { appendLog, createLogStream } from '@services/logManager';
import { IDockerContainer } from '@typings/models/docker/container';

class RepositoryHandler{
    private repository: IRepository;
    private repositoryId: string;
    private container: IDockerContainer | null;

    constructor(repository: IRepository){
        this.repository = repository;
        this.repositoryId = this.repository._id.toString();
        this.container = null;
    }

    getValidCommands(): string[]{
        const { buildCommand, installCommand, startCommand } = this.repository;
        return [installCommand, buildCommand, startCommand].filter(Boolean) as string[];
    }

    async getCurrentDeployment(): Promise<any>{
        const currentDeploymentId = this.repository.deployments.slice(-1)[0]
        return await Deployment
            .findById(currentDeploymentId)
            .select('environment githubDeploymentId status');
    }

    async getContainer(): Promise<IDockerContainer | null>{
        if(this.container) return this.container;
        this.container = await DockerContainer.findOne({ repository: this.repositoryId });
        return this.container;
    }

    async start(githubService: GithubService): Promise<void>{
        try{
            if(this.getValidCommands().length === 0) return;
            const { installCommand, buildCommand, startCommand } = this.repository;
            const buildCommands = [installCommand, buildCommand].filter(Boolean) as string[];
            const deployment = await this.getCurrentDeployment();
            const { githubDeploymentId } = deployment;
            deployment.status = 'building';
            await deployment.save();
            const repositoryContainer = await this.getContainer();
            if(!repositoryContainer) return;
            const svc = new DockerContainerService(repositoryContainer);
            const userId = repositoryContainer.user.toString();
            const containerId = repositoryContainer._id.toString();
            const workingDir = '/app' + (this.repository.rootDirectory || '');
            await createLogStream(userId, containerId);
            for(const cmd of buildCommands){
                const res = await svc.executeCommand(cmd, { WorkingDir: workingDir });
                await appendLog(userId, containerId, res.output);
                if(res.exitCode !== 0){
                    deployment.status = 'failure';
                    await deployment.save();
                    await githubService.updateDeploymentStatus(githubDeploymentId, 'failure');
                    return;
                }
            }
            if(startCommand){
                svc.executeCommand('sh -c "' + startCommand.replace(/"/g, '\\"') + ' &"', { WorkingDir: workingDir }).catch(() => {});
            }
            deployment.status = 'success';
            await deployment.save();
            await githubService.updateDeploymentStatus(githubDeploymentId, 'success');
        }catch(error){
            logger.error('@services/repositoryHandler.ts (start): ' + error);
        }
    }
}

export default RepositoryHandler;