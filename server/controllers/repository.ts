import Repository from '@models/repository';
import HandlerFactory from '@controllers/common/handlerFactory';
import Deployment from '@models/deployment';
import Github from '@services/github';
import { catchAsync } from '@utilities/helpers';
import { Response, NextFunction } from 'express';
import { IRepository } from '@typings/models/repository';
import { IRequest } from '@typings/controllers/common';
import { Octokit } from '@octokit/rest';
import { detectPreset } from '@services/runtime/detect';
import { enqueueDeploy } from '@services/orchestrator';
import { ensureOrgDefaults } from '@services/tenancy/provisioning';
import RuntimeError from '@utilities/runtimeError';

const RepositoryFactory = new HandlerFactory({
    model: Repository,
    scope: { field: 'organization' },
    fields: [
        'name',
        'owner',
        'url',
        'user',
        'organization',
        'project',
        'environment',
        'alias',
        'deployments', 
        'container',
        'buildCommand',
        'port', 
        'installCommand', 
        'branch',
        'startCommand', 
        'rootDirectory',
        'framework',
        'runtime',
        'runtimeVersion',
        'outputDirectory'
    ]
});

export const getRepositories = RepositoryFactory.getAll();
export const getRepository = RepositoryFactory.getOne();
export const deleteRepository = RepositoryFactory.deleteOne();

const COMMAND_FIELDS = ['buildCommand', 'installCommand', 'startCommand', 'rootDirectory'];

/**
 * Updates a repository. When build/install/start commands (or the root dir)
 * change, a redeploy is ENQUEUED after the update — replacing the old
 * Repository.pre('findOneAndUpdate') hook that fired a fire-and-forget build.
 */
export const updateRepository = RepositoryFactory.updateOne({
    async responseInterceptor(req: IRequest, res: Response, body: any): Promise<void>{
        const changedCommands = COMMAND_FIELDS.some((f) => req.body?.[f] !== undefined);
        const repo = body?.data;
        if(changedCommands && repo?._id){
            await enqueueDeploy(repo._id.toString(), { reason: 'manual', userId: repo.user?.toString() });
        }
        res.status(200).json(body);
    }
});

/**
 * Creates a repository, then ENQUEUES the initial deploy. The model's pre('save')
 * hook is now pure persistence — it no longer creates containers, clones, or
 * builds. All of that runs asynchronously in the orchestrator (ADR-0001), so this
 * returns 201 with the new repo immediately and the build progresses in the
 * background (status surfaced via the deployment:status socket event).
 */
export const createRepository = catchAsync(async (req: IRequest, res: Response, next: NextFunction) => {
    const user: any = req.user;
    const allowed = [
        'name', 'owner', 'url', 'alias', 'buildCommand', 'port', 'installCommand',
        'branch', 'startCommand', 'rootDirectory', 'framework', 'runtime',
        'runtimeVersion', 'outputDirectory'
    ];
    const data: Record<string, any> = { user: user._id };
    for(const key of allowed){
        if(req.body[key] !== undefined) data[key] = req.body[key];
    }
    // Stamp tenancy from the request-resolved tenant. The active org comes from
    // resolveTenant (scoped route → guaranteed, or already errored Reconfigure);
    // there is no silent defaultOrganization fallback and no auto-org creation.
    const tenant = req.tenant;
    const orgId = tenant?.org?._id;
    if(!orgId){
        return next(new RuntimeError('Repository::Organization::Required', 400));
    }
    data.organization = orgId;
    // Project/environment: prefer the resolved tenant; otherwise fall back to the
    // org's OWN defaults (its default project + production env), never a personal org.
    if(tenant?.project?._id) data.project = tenant.project._id;
    if(!data.project || !data.environment){
        const { project, environment } = await ensureOrgDefaults(orgId);
        if(!data.project) data.project = project._id;
        if(!data.environment) data.environment = environment._id;
    }
    const repository = await Repository.create(data);
    await enqueueDeploy(repository._id.toString(), { reason: 'initial', userId: user._id.toString() });
    res.status(201).json({ status: 'success', data: repository });
});

/**
 * Rolls a repository back to a prior deployment's immutable build artifact. The
 * deploy worker re-runs that artifact tag without rebuilding (Phase 3 rollback).
 * Returns 202 — the swap runs asynchronously via the orchestrator.
 */
export const rollbackRepository = catchAsync(async (req: IRequest, res: Response) => {
    const user: any = req.user;
    const { id, deploymentId } = req.params;
    const repository = await Repository.findOne({ _id: id }).select('_id user');
    if(!repository){
        throw new RuntimeError('Repository::Not::Found', 404);
    }
    const target = await Deployment.findOne({ _id: deploymentId, repository: repository._id }).select('artifact');
    if(!target?.artifact?.tag){
        throw new RuntimeError('Deployment::Rollback::NoArtifact', 400);
    }
    const job = await enqueueDeploy(repository._id.toString(), {
        reason: 'rollback',
        rollbackTo: deploymentId,
        userId: user._id.toString()
    });
    res.status(202).json({ status: 'success', data: { jobId: job._id.toString(), status: job.status } });
});

const getGithubRepositories = async (accessToken: string): Promise<any[]> => {
    const octokit = new Octokit({ auth: accessToken });

    const repos = await octokit.paginate(
        octokit.rest.repos.listForAuthenticatedUser,
        { visibility: 'all', per_page: 100 }
    );

    const reposWithBranches = await Promise.all(
        repos.map(async repo => {
            const branches = await octokit.paginate(
                octokit.rest.repos.listBranches,
                { owner: repo.owner.login, repo: repo.name, per_page: 100 }
            );
            return { ...repo, branches: branches.map(b => b.name) };
        })
    );

    return reposWithBranches;
};

const filterRepositories = (githubRepositories: any[], userRepositories: any[]): any[] => 
    githubRepositories.filter(repo => !userRepositories.some(userRepo => userRepo.name === repo.name && userRepo.owner === repo.owner.login));

export const getMyGithubRepositories = catchAsync(async (req: IRequest, res: Response) => {
    const user: any = req.user;
    if(!user.github){
        throw new RuntimeError('Github::Account::NotLinked', 400);
    }
    const githubRepositories = await getGithubRepositories(user.github.getDecryptedAccessToken());
    const sanitizedRepositories = filterRepositories(githubRepositories, user.repositories);
    res.status(200).json({ status: 'success', data: sanitizedRepositories });
});

export const detectFramework = catchAsync(async (req: IRequest, res: Response) => {
    const user: any = req.user;
    if(!user.github){
        throw new RuntimeError('Github::Account::NotLinked', 400);
    }
    const { owner, repo } = req.params;
    const octokit = new Octokit({ auth: user.github.getDecryptedAccessToken() });
    const { data } = await octokit.rest.repos.getContent({ owner, repo, path: '' });
    const files = Array.isArray(data) ? data.map((file) => file.name) : [];
    let packageJson;
    try{
        const { data: pkg } = await octokit.rest.repos.getContent({ owner, repo, path: 'package.json' });
        if(!Array.isArray(pkg) && pkg.type === 'file'){
            packageJson = JSON.parse(Buffer.from(pkg.content, 'base64').toString('utf8'));
        }
    }catch(error){
        // Ignore if package.json does not exist (404).
    }
    res.status(200).json({ status: 'success', data: detectPreset(files, packageJson) });
});

export const getMyRepositories = RepositoryFactory.getAll({
    middlewares: {
        pre: [async (req: IRequest): Promise<void> => { 
            req.query.user = req.user;
            req.query.populate = 'deployments container'; 
        }]
    },
    async responseInterceptor(req: IRequest, res: Response, body): Promise<void>{
        const user: any = req.user;
        const data = JSON.parse(JSON.stringify(body));
        for(const repo of data.data){
            // The active deployment is the MOST RECENT one (deployments is push-ordered),
            // not deployments[0] (the oldest). 'deployments' is already populated by the
            // pre-middleware, so read its status directly instead of re-querying.
            const deployments = repo.deployments || [];
            const activeDeployment = deployments[deployments.length - 1];
            if(activeDeployment && activeDeployment.status){
                repo.activeDeployment = { _id: activeDeployment._id, status: activeDeployment.status };
            }
        }
        const enrichedData = await Promise.all(data.data.map(async (repo: IRepository) => {
            const github = new Github(user, repo);
            // Never let a single repo's remote lookup drop it from the list or fail the
            // whole dashboard. getRepositoryInfo() is non-destructive and returns a
            // { remoteUnavailable } marker on error; we always keep the stored repo data.
            const repoInfo = await github.getRepositoryInfo().catch(() => ({ remoteUnavailable: true }));
            return { ...repoInfo, ...repo };
        }));
        res.status(200).json({
            status: 'success',
            ...body,
            data: enrichedData
        });
    }
});