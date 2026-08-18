import Repository from '@models/repository';
import HandlerFactory from '@controllers/common/handlerFactory';
import Deployment from '@models/deployment';
import DockerContainer from '@models/docker/container';
import Github from '@services/github';
import { catchAsync, filterObject } from '@utilities/helpers';
import { Response, NextFunction } from 'express';
import { IRepository } from '@typings/models/repository';
import { IRequest } from '@typings/controllers/common';
import { Octokit } from '@octokit/rest';
import { detectPreset } from '@services/runtime/detect';
import { enqueueDeploy, enqueueReload } from '@services/orchestrator';
import { ensureOrgDefaults } from '@services/tenancy/provisioning';
import { resolveRepositoryOr403 } from '@middlewares/tenancy';
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

const REDEPLOY_FIELDS = [
    'buildCommand', 'installCommand', 'startCommand', 'rootDirectory',
    'branch', 'framework', 'runtime', 'runtimeVersion', 'outputDirectory'
];
const RELOAD_FIELDS = ['port'];

export const updateRepository = RepositoryFactory.updateOne({
    async responseInterceptor(req: IRequest, res: Response, body: any): Promise<void>{
        const repo = body?.data;
        if(repo?._id){
            const changedRedeploy = REDEPLOY_FIELDS.some((f) => req.body?.[f] !== undefined);
            const changedReload = RELOAD_FIELDS.some((f) => req.body?.[f] !== undefined);
            const actorId = (req.user as any)?._id?.toString();
            if(changedRedeploy){
                await enqueueDeploy(repo._id.toString(), { reason: 'manual', userId: actorId });
            }else if(changedReload){

                const container = await DockerContainer.findOne({ repository: repo._id }).select('_id');
                if(container){
                    await enqueueReload(container._id.toString(), { userId: actorId });
                }
            }
        }
        res.status(200).json(body);
    }
});

export const createRepository = catchAsync(async (req: IRequest, res: Response, next: NextFunction) => {
    const user: any = req.user;
    const allowed = [
        'name', 'owner', 'url', 'alias', 'buildCommand', 'port', 'installCommand',
        'branch', 'startCommand', 'rootDirectory', 'framework', 'runtime',
        'runtimeVersion', 'outputDirectory'
    ];
    const data: Record<string, any> = { user: user._id, ...filterObject(req.body, ...allowed) };

    const tenant = req.tenant;
    const orgId = tenant?.org?._id;
    if(!orgId){
        return next(new RuntimeError('Repository::Organization::Required', 400));
    }
    data.organization = orgId;

    if(tenant?.project?._id) data.project = tenant.project._id;
    if(!data.project || !data.environment){
        const { project, environment } = await ensureOrgDefaults(orgId);
        if(!data.project) data.project = project._id;
        if(!data.environment) data.environment = environment._id;
    }
    const repository = await Repository.create(data);
    const job = await enqueueDeploy(repository._id.toString(), { reason: 'initial', userId: user._id.toString() });
    res.status(201).json({ status: 'success', data: { ...repository.toObject(), jobId: job._id.toString() } });
});

export const rollbackRepository = catchAsync(async (req: IRequest, res: Response) => {
    const user: any = req.user;
    const { id, deploymentId } = req.params;
    const repository = await resolveRepositoryOr403(req, id, 'Deployment::Rollback');
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

            const deployments = repo.deployments || [];
            const activeDeployment = deployments[deployments.length - 1];
            if(activeDeployment && activeDeployment.status){
                repo.activeDeployment = { _id: activeDeployment._id, status: activeDeployment.status };
            }
        }
        const enrichedData = await Promise.all(data.data.map(async (repo: IRepository) => {
            const github = new Github(user, repo);

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