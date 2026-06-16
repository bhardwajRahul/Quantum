/***
 * Copyright (C) Rodolfo Herrera Hernandez. All rights reserved.
 * Licensed under the MIT license. See LICENSE file in the project root
 * for full license information.
 *
 * =+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+
 *
 * For related information - https://github.com/rodyherrera/Quantum/
 *
 * All your applications, just in one place. 
 *
 * =-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-
****/

import { Octokit } from '@octokit/rest';
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

// Short-lived cache for repository info to avoid GitHub N+1 on dashboard polling.
const repoInfoCache = new Map<string, { at: number, data: any }>();
const REPO_INFO_TTL = 60000;

/**
 *  This class is designed to interact with the GitHub API on behalf of a user,  
 *  handling repository-related actions within the Quantum Cloud platform.
 *
 * @param {IUser} user - The Quantum Cloud user object 
 * @param {IRepository} repository - The Quantum Cloud repository object
*/
class Github{
    private user: IUser;
    private repository: IRepository;
    private userGithub?: IGithub;
    private octokit: Octokit;
    private owner: string;

    constructor(user: IUser, repository: IRepository){
        this.user = user;
        this.repository = repository;
        // user.github may be undefined: a repo can exist for a user who never linked
        // GitHub (manual URL), and read paths like getMyRepositories build a Github
        // per repo. Don't crash the constructor — create an unauthenticated octokit;
        // any API call then fails into getRepositoryInfo's graceful-degrade catch.
        this.userGithub = user?.github as IGithub | undefined;
        const accessToken = this.userGithub?.getDecryptedAccessToken?.();
        this.octokit = new Octokit(accessToken ? { auth: accessToken } : {});
        this.owner = repository?.owner || this.userGithub?.username || '';
    }

    /**
     * Deletes a locally-stored log file and a working directory associated with a repository.
     * Used as a cleanup mechanism in case of errors.
     *
     * @param {string} logPath - Path to the log file to be deleted.
     * @param {string} directoryPath - Path to the directory to be deleted.
     * @returns {Promise<void>} - Resolves if deletion is successful, rejects with an error if not.
    */
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
    
    /**
     * Clones a GitHub repository into a local directory.
     *
     * @returns {Promise<void>} - Resolves if the cloning process is successful, rejects with an error if not.
    */
    async cloneRepository(branch: string): Promise<void>{
        try{
            const container = await this.getContainer();
            if(!container){
                throw new RuntimeError('Github::Container::NotFound', 404);
            }
            const repositoryInfo = await this.octokit.repos.get({ 
                owner: this.owner, 
                repo: this.repository.name 
            });
            const cloneEndpoint = repositoryInfo.data.private
                ? repositoryInfo.data.clone_url.replace('https://', `https://${this.userGithub?.getDecryptedAccessToken?.() || ''}@`)
                : repositoryInfo.data.clone_url;
            await execFile('git', ['clone', '--branch', branch, cloneEndpoint, container.storagePath]);
        }catch(error){
            logger.error('@services/github.ts (cloneRepository): ' + (error as Error).message);
        }
    }

    /**
     * Reads environment variables defined in `.env` files within a cloned repository.
     *
     * @returns {Promise<Object>} - An object containing key-value pairs of environment variables. 
    */
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

    /**
     * Retrieves information about the latest commit on the main branch.
     *
     * @returns {Promise<Object>} - An object containing details about the commit (message, author, etc.).
    */
    async getLatestCommit(): Promise<any>{
        const { data: commits } = await this.octokit.repos.listCommits({
            owner: this.owner,
            repo: this.repository.name,
            per_page: 1,
            sha: this.repository.branch
        });
        return commits[0];
    }

    /**
     * Creates a new deployment record in the database and updates old deployments.
     *
     * @param {number} githubDeploymentId - The ID of the newly created GitHub deployment.
     * @returns {Promise<Deployment>} - The newly created Deployment object.
    */
    async createNewDeployment(githubDeploymentId: number): Promise<IDeployment>{
        const environmentVariables = await this.readEnvironmentVariables();
        const currentDeployment = this.repository.deployments.pop();
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
        // Merge org-level env vars as a FALLBACK only (app/repo values win): freeze
        // them into the deployment's environment.variables at create so the existing
        // getEnvironmentArray + container Env injection consume them with no further
        // change. Wrapped in try/catch so a lookup failure never breaks a deploy.
        try{
            const OrgEnvVar = (await import('@models/orgEnvVar')).default;
            const orgVars = await OrgEnvVar.find({ organization: this.repository.organization }).select('+valueEnc');
            for(const v of orgVars){
                if(!(v.key in environmentVariables)){
                    const decrypted = v.getDecryptedValue();
                    if(decrypted !== null) environmentVariables[v.key] = decrypted;
                }
            }
        }catch(error){
            logger.error('@services/github.ts (createNewDeployment): org env var merge failed: ' + error);
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
        return newDeployment;
    }

    /**
     * Updates the deployment status on GitHub (e.g., "success", "failure", "pending").
     *
     * @param {string} deploymentId - The ID of the deployment to update.
     * @param {string} DeploymentState - The new status (e.g., "pending", "success", "failure").
     * @returns {Promise<void>} - Resolves when the update is sent to GitHub.
    */
    async updateDeploymentStatus(deploymentId: string | number, state: DeploymentState): Promise<void>{
        await this.octokit.repos.createDeploymentStatus({
            owner: this.owner,
            repo: this.repository.name,
            deployment_id: Number(deploymentId),
            state
        });   
    }

    /**
     * Creates a new deployment on GitHub for the associated repository.
     * 
     * @returns {Promise<number>} - The ID of the newly created deployment.
     * @throws {RuntimeError} - If the deployment creation fails on GitHub's side.
    */
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

    /**
     * Retrieves detailed information about the associated GitHub repository.
     *
     * @returns {Promise<Object>} - An object containing repository details (e.g., name, description, owner, etc.).
    */
    async getRepositoryDetails(): Promise<any>{
        const { data: repositoryDetails } = await this.octokit.repos.get({
            owner: this.owner,
            repo: this.repository.name
        });
        return repositoryDetails;
    }

    /**
     * Fetches essential repository information, including the latest commit details.
     * Handles potential errors if the repository has been deleted.
     *
     * @returns {Promise<Object>} - An object containing:
     *   * branch: The default branch name
     *   * website: The repository's homepage URL (if defined)
     *   * latestCommitMessage: The message of the most recent commit
     *   * latestCommit: The date and time of the most recent commit
     * @returns {null} - If the repository is deleted on GitHub.
    */
    async getRepositoryInfo(): Promise<any | null>{
        const cacheKey = `${this.owner}/${this.repository.name}`;
        const cached = repoInfoCache.get(cacheKey);
        if(cached && Date.now() - cached.at < REPO_INFO_TTL){
            return cached.data;
        }
        try{
            const latestCommit = await this.getLatestCommit();
            const details = await this.getRepositoryDetails();
            const information = {
                branch: details.default_branch,
                website: details.homepage,
                latestCommitMessage: latestCommit.commit.message,
                latestCommit: latestCommit.commit.author.date
            };
            repoInfoCache.set(cacheKey, { at: Date.now(), data: information });
            return information;
        }catch(error){
            // IMPORTANT: this runs on a read path (dashboard polling). It must NEVER
            // mutate or delete data. A GitHub 'Not Found' can be transient — a rename,
            // a revoked/expired token, rate-limiting, or a private repo the token can no
            // longer see — and previously this deleted the user's Repository document
            // (and cascaded its deployments/container/webhook), causing irreversible,
            // silent data loss triggered by a routine read.
            //
            // Instead we degrade gracefully: surface that the remote is currently
            // unreachable and let the caller fall back to stored data. Reconciling a
            // genuinely-deleted GitHub repo belongs on an explicit, user-driven action,
            // not on a polling read.
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

    /**
     * Creates a new webhook for the repository on GitHub, configured to trigger on 'push' events.
     *
     * @param {string} webhookUrl - The URL to which webhook events will be sent.
     * @param {string} webhookSecret - A secret used to verify the authenticity of webhook payloads.
     * @returns {Promise<number>} - The ID of the newly created webhook.
    */
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
            // TODO: In future versions, it would be useful to be able to clone 
            // repositories that do not exactly belong to the authenticated user, obviously 
            // hooks should not be registered for this, therefore this error should only be 
            // thrown when a repository that belongs to the authenticated user exceeds that limit.
            if(errorMessage === 'The "push" event cannot have more than 20 hooks'){
                throw new RuntimeError('Github::Repository::Excess::Hooks', 400);
            }
            // TODO: Maybe it would be useful here to notify the administrator by email?
            throw new RuntimeError('Github::Webhook::Creation::Error', 500);
        }
    }

    /**
     * Deletes an existing webhook from the repository on GitHub. Handles cases where repositories might not have webhooks.
     *
     * @returns {Promise<void>} - Resolves if deletion is successful, or if there's no webhook to delete.
     * @throws {Error} - If the webhook deletion process encounters an error on GitHub's side.
    */
    async deleteWebhook(): Promise<any | void>{
        // Some repositories will not have a webhook, and this is because if 
        // the repository is archived (Read-Only) it will not allow 
        // updates, therefore no hooks.
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

    /**
     * Lists existing deployments for the repository on GitHub.
     *
     * @returns {Promise<Array<Object>>} - An array of deployment objects, each containing deployment details.
    */
    async getRepositoryDeployments(): Promise<any[]>{
        const { data: deployments } = await this.octokit.repos.listDeployments({
            owner: this.owner,
            repo: this.repository.name
        });
        return deployments;
    }

    /**
     * Deletes a specified deployment on GitHub. 
     *
     * @param {number} deploymentId - The ID of the deployment to delete.
     * @returns {Promise<void>} - Resolves if the deployment deletion is successful.
    */
    async deleteRepositoryDeployment(deploymentId: string | number): Promise<void>{
        await this.octokit.repos.deleteDeployment({
            owner: this.owner,
            repo: this.repository.name,
            deployment_id: Number(deploymentId)
        });
    }

    /**
     * Orchestrates the deployment process for a repository. Includes 
     * cloning, creating a GitHub deployment, and updating 
     * the deployment status.
     *
     * @returns {Promise<Deployment>} - The newly created Deployment object, representing the deployment record in the Quantum Cloud system.
    */
    async deployRepository(): Promise<IDeployment>{
        await this.cloneRepository(this.repository.branch);
        const githubDeploymentId = await this.createGithubDeployment();
        const newDeployment = await this.createNewDeployment(githubDeploymentId);
        newDeployment.url = `https://github.com/${this.owner}/${this.repository.name}/deployments/${githubDeploymentId}`;
        newDeployment.status = 'pending';
        await newDeployment.save();
        await this.updateDeploymentStatus(githubDeploymentId, 'in_progress');
        return newDeployment;
    };
};

export default Github;

/**
 * Tear down a deleted repository's GitHub-side state: remove the webhook and mark
 * its deployments inactive/deleted. Relocation of the GitHub I/O that used to be
 * inlined in models/repository.ts's delete hook (ADR-0001) — the model now
 * delegates here. Best-effort: never throws into the delete path.
 */
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