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
            const { installCommand, buildCommand, startCommand } = this.repository;
            const buildCommands = [installCommand, buildCommand].filter(Boolean) as string[];
            if(buildCommands.length === 0 && !startCommand) return;
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
            const envArray = deployment.getEnvironmentArray();
            await createLogStream(userId, containerId);
            const runBuild = async (): Promise<boolean> => {
                for(const cmd of buildCommands){

                    const res = await svc.executeCommand(['sh', '-c', cmd], { WorkingDir: workingDir, Env: envArray } as any);
                    await appendLog(userId, containerId, res.output);
                    if(res.exitCode !== 0) return false;
                }
                return true;
            };
            let built = await runBuild();
            if(!built){

                await new Promise((resolve) => setTimeout(resolve, 5000));
                built = await runBuild();
            }
            if(!built){
                deployment.status = 'failure';
                await deployment.save();
                await githubService.updateDeploymentStatus(githubDeploymentId, 'failure');
                return;
            }
            if(startCommand){

                svc.executeCommand(['sh', '-c', `${startCommand} &`], { WorkingDir: workingDir, Env: envArray } as any).catch(() => {});
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