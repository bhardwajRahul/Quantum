import { Octokit } from '@octokit/rest';
import mongoose from 'mongoose';
import { promisify } from 'util';
import { execFile as execFileCallback } from 'child_process';
import { IRepository } from '@typings/models/repository';
import { IUser } from '@typings/models/user';
import { IGithub } from '@typings/models/github';
import { IDeployment } from '@typings/models/deployment';
import { DeploymentState } from '@typings/services/github';
import { IDockerContainer } from '@typings/models/docker/container';
import simpleGit from 'simple-git';
import logger from '@utilities/logger';
import Deployment from '@models/deployment';
import RuntimeError from '@utilities/runtimeError';
import fs from 'fs';
import DockerContainer from '@models/docker/container';

const execFile = promisify(execFileCallback);

const repoInfoCache = new Map<string, { at: number, data: any }>();
const REPO_INFO_TTL = 60000;

class Github{
    private user: IUser;
    private repository: IRepository;
    private userGithub?: IGithub;
    private octokit: Octokit;
    private owner: string;

    constructor(user: IUser, repository: IRepository){
        this.user = user;
        this.repository = repository;

        this.userGithub = user?.github as IGithub | undefined;
        const accessToken = this.userGithub?.getDecryptedAccessToken?.();
        this.octokit = new Octokit(accessToken ? { auth: accessToken } : {});
        this.owner = repository?.owner || this.userGithub?.username || '';
    }

    static async deleteLogAndDirectory(logPath: string, directoryPath: string): Promise<void>{
        try{
            if(logPath) await fs.promises.rm(logPath);
            await fs.promises.rm(directoryPath, { recursive: true });
        }catch(error){
            logger.error('@services/github.ts (deleteLogAndDirectory): CRITCAL ERROR -> Deletion failed: ' + (error as Error).message);
        }
    }

    async getContainer(): Promise<IDockerContainer | null>{
        const container = await DockerContainer.findOne({ repository: this.repository._id });
        return container;
    }

    async cloneRepository(branch: string): Promise<void>{
        const container = await this.getContainer();
        if(!container){
            throw new RuntimeError('Github::Container::NotFound', 404);
        }
        try{
            const repositoryInfo = await this.octokit.repos.get({
                owner: this.owner,
                repo: this.repository.name
            });
            const cloneEndpoint = repositoryInfo.data.private
                ? repositoryInfo.data.clone_url.replace('https://', `https://${this.userGithub?.getDecryptedAccessToken?.() || ''}@`)
                : repositoryInfo.data.clone_url;
            await execFile('git', ['clone', '--branch', branch, cloneEndpoint, container.storagePath]);
        }catch(error: any){
            logger.error('@services/github.ts (cloneRepository): ' + (error?.message || error));

            if(container.storagePath){
                await fs.promises.rm(container.storagePath, { recursive: true, force: true }).catch(() => {});
            }

            throw error;
        }
    }

    async readEnvironmentVariables(): Promise<Record<string, string>>{
        const container = await this.getContainer();
        if(!container){
            throw new RuntimeError('Github::Container::NotFound', 404);
        }
        const files = await simpleGit(container.storagePath).raw(['ls-tree', 'HEAD', '-r', '--name-only']);
        const envFiles = files.split('\n').filter(file => file.includes('.env'));
        const environmentVariables: Record<string, string> = {};
        for(const envFile of envFiles){
            const file = await simpleGit(container.storagePath).raw(['show', 'HEAD:' + envFile]);
            const lines = file.split('\n');
            lines.forEach(line => {
                if(line.trim() === '' || line.trim().startsWith('#')){
                    return;
                }
                const [key, value] = line.split('=');
                environmentVariables[key.trim()] = value?.trim() || '';
            });
        }
        return environmentVariables;
    }

    async getLatestCommit(): Promise<any>{
        const { data: commits } = await this.octokit.repos.listCommits({
            owner: this.owner,
            repo: this.repository.name,
            per_page: 1,
            sha: this.repository.branch
        });
        return commits[0];
    }

    async createNewDeployment(githubDeploymentId: number): Promise<IDeployment>{
        const environmentVariables = await this.readEnvironmentVariables();

        const currentDeployment = this.repository.deployments?.at(-1);
        if(currentDeployment){
            const deployment = await Deployment.findById(currentDeployment._id);
            if(deployment && deployment.environment){
                const { environment } = deployment;
                for(const [key, value] of Object.entries(environment.variables)){
                    if(!(key in environmentVariables)){
                        continue;
                    }
                    environmentVariables[key] = value;
                }
            }
        }

        const latestCommit = await this.getLatestCommit();
        const newDeployment = new Deployment({
            user: this.user._id,
            organization: this.repository.organization,
            githubDeploymentId,
            repository: this.repository._id,
            environment: {
                variables: environmentVariables
            },
            commit: {
                message: latestCommit.commit.message,
                author: {
                    name: latestCommit.commit.author.name,
                    email: latestCommit.commit.author.email
                },
                status: 'pending'
            }
        });
        await newDeployment.save();

        await mongoose.model('Repository').updateOne(
            { _id: this.repository._id },
            { $addToSet: { deployments: newDeployment._id } }
        ).catch(() => {});
        return newDeployment;
    }

    async updateDeploymentStatus(deploymentId: string | number, state: DeploymentState): Promise<void>{
        await this.octokit.repos.createDeploymentStatus({
            owner: this.owner,
            repo: this.repository.name,
            deployment_id: Number(deploymentId),
            state
        });
    }

    async createGithubDeployment(): Promise<number>{
        const { data: { id: deploymentId } }: any = await this.octokit.repos.createDeployment({
            owner: this.owner,
            repo: this.repository.name,
            ref: this.repository.branch,
            auto_merge: false,
            required_contexts: [],
            environment: 'Production'
        });
        if(!deploymentId)
            throw new RuntimeError('Deployment::Not::Created', 500);
        return deploymentId;
    }

    async getRepositoryDetails(): Promise<any>{
        const { data: repositoryDetails } = await this.octokit.repos.get({
            owner: this.owner,
            repo: this.repository.name
        });
        return repositoryDetails;
    }

    async getRepositoryInfo(): Promise<any | null>{
        const cacheKey = `${this.owner}/${this.repository.name}`;
        const cached = repoInfoCache.get(cacheKey);
        if(cached && Date.now() - cached.at < REPO_INFO_TTL){
            return cached.data;
        }
        try{
            const [latestCommit, details] = await Promise.all([
                this.getLatestCommit(),
                this.getRepositoryDetails()
            ]);
            const information = {
                branch: details.default_branch,
                website: details.homepage,
                latestCommitMessage: latestCommit.commit.message,
                latestCommit: latestCommit.commit.author.date
            };
            repoInfoCache.set(cacheKey, { at: Date.now(), data: information });
            return information;
        }catch(error){

            const remoteMessage = (error as any)?.response?.data?.message;
            const isNotFound = remoteMessage === 'Not Found';
            logger.warn(
                `@services/github.ts (getRepositoryInfo): Unable to fetch remote info for ` +
                `${cacheKey} (${remoteMessage || (error as Error).message}). ` +
                `Returning degraded info without modifying stored data.`
            );
            return { remoteUnavailable: true, remoteNotFound: isNotFound };
        }
    }

    async createWebhook(webhookUrl: string, webhookSecret: string): Promise<number | void>{
        try{
            const response = await this.octokit.repos.createWebhook({
                owner: this.owner,
                repo: this.repository.name,
                name: 'web',
                config: {
                    url: webhookUrl,
                    content_type: 'json',
                    secret: webhookSecret
                },
                events: ['push'],
                active: true
            });
            const { id } = response.data;
            return id;
        }catch(error){
            if(!(error as any)?.response?.data?.errors?.[0]) return;
            const errorMessage = (error as any).response.data.errors[0].message;

            if(errorMessage === 'The "push" event cannot have more than 20 hooks'){
                throw new RuntimeError('Github::Repository::Excess::Hooks', 400);
            }

            throw new RuntimeError('Github::Webhook::Creation::Error', 500);
        }
    }

    async deleteWebhook(): Promise<any | void>{

        if(!this.repository.webhookId) return;
        try{
            const response = await this.octokit.repos.deleteWebhook({
                owner: this.owner,
                repo: this.repository.name,
                hook_id: Number(this.repository.webhookId)
            });
            return response;
        }catch(error: any){
            const errorMessage = error.message || '';
            const errorStatus = error.status || 500;

            if(errorStatus === 404 || errorMessage.includes('Not Found')){
                logger.warn(`@services/github.ts (deleteWebhook): Webhook not found, ignoring error. Repo: ${this.repository.name}`);
                return;
            }

            logger.error(`@services/github.ts (deleteWebhook): Error deleting webhook: ${errorMessage}`);
            throw error;
        }
    }

    async getRepositoryDeployments(): Promise<any[]>{
        const { data: deployments } = await this.octokit.repos.listDeployments({
            owner: this.owner,
            repo: this.repository.name
        });
        return deployments;
    }

    async deleteRepositoryDeployment(deploymentId: string | number): Promise<void>{
        await this.octokit.repos.deleteDeployment({
            owner: this.owner,
            repo: this.repository.name,
            deployment_id: Number(deploymentId)
        });
    }

    async deployRepository(): Promise<IDeployment>{

        const [, githubDeploymentId] = await Promise.all([
            this.cloneRepository(this.repository.branch),
            this.createGithubDeployment()
        ]);
        const newDeployment = await this.createNewDeployment(githubDeploymentId);
        newDeployment.url = `https://github.com/${this.owner}/${this.repository.name}/deployments/${githubDeploymentId}`;
        newDeployment.status = 'pending';
        await newDeployment.save();
        await this.updateDeploymentStatus(githubDeploymentId, 'in_progress');
        return newDeployment;
    };
};

export default Github;

export const teardownRepositoryGithub = async (
    repository: any,
    repositoryUser: any,
    deployments: { githubDeploymentId: string | number }[]
): Promise<void> => {
    try{
        const github = new Github(repositoryUser, repository);
        await github.deleteWebhook();
        if(!deployments.length) return;
        await github.updateDeploymentStatus(deployments[0].githubDeploymentId, 'inactive');
        await Promise.all(deployments.map((deployment) =>
            github.deleteRepositoryDeployment(deployment.githubDeploymentId)));
    }catch(error: any){
        logger.warn('@services/github.ts (teardownRepositoryGithub): ' + (error?.message || error));
    }
};