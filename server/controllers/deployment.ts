import Deployment from '@models/deployment';
import Repository from '@models/repository';
import HandlerFactory from '@controllers/common/handlerFactory';
import RuntimeError from '@utilities/runtimeError';
import Github from '@services/github';
import { catchAsync } from '@utilities/helpers';
import { enqueueLifecycle } from '@services/orchestrator';
import { resolveRepositoryOr403 } from '@middlewares/tenancy';
import { IRequest } from '@typings/controllers/common';
import { Request, Response } from 'express';

const DeploymentFactory = new HandlerFactory({
    model: Deployment,
    scope: { field: 'organization' },
    fields: [
        'user',
        'organization',
        'repository',
        'environment',
        'commit',
        'status',
        'url'
    ]
});

export const getDeployments = DeploymentFactory.getAll();
export const getDeployment = DeploymentFactory.getOne();
export const updateDeployment = DeploymentFactory.updateOne();
export const deleteDeployment = DeploymentFactory.deleteOne();

const resolveRepositoryByAliasOr403 = async (req: IRequest, alias: string, prefix: string) => {
    const tenant = (req as any).tenant;

    const orgIds = (tenant?.orgIds || []).map(String);
    const filter: any = tenant?.isPlatformAdmin
        ? { alias }
        : (orgIds.length > 0
            ? { alias, organization: { $in: orgIds } }
            : { alias, user: (req.user as any)?._id });
    const repository = await Repository.findOne(filter).select('_id user organization project');
    if(!repository) throw new RuntimeError(`${prefix}::Repository::NotFound`, 404);
    return resolveRepositoryOr403(req, repository._id.toString(), prefix);
};

export const repositoryOperations = catchAsync(async (req: IRequest, res: Response) => {
    const { user } = req as any;
    const { repositoryAlias } = req.params;
    const repository = await resolveRepositoryByAliasOr403(req, repositoryAlias, 'Lifecycle');
    const { action } = req.body;

    const job = await enqueueLifecycle(repository._id.toString(), action, user._id.toString());
    res.status(202).json({
        status: 'success',
        data: { jobId: job._id.toString(), status: job.status, action }
    });
});

const toDeploymentRow = (deployment: any) => ({
    id: deployment._id,
    _id: deployment._id,
    commit: deployment.commit || undefined,
    status: deployment.status,
    environment: 'Production',
    url: deployment.url || '',
    created_at: deployment.createdAt,
    artifact: deployment.artifact
});

const listLocalDeployments = async (repositoryId: any) => {
    const deployments = await Deployment
        .find({ repository: repositoryId })
        .sort({ createdAt: -1 })
        .select('commit status url artifact createdAt');
    return deployments.map(toDeploymentRow);
};

export const getRepositoryDeployments = catchAsync(async (req: Request, res: Response) => {
    const { user } = req as any;
    const { repositoryName } = req.params;
    const repository = await Repository.findOne({ name: repositoryName, user: user._id }).select('_id');
    if(!repository)
        throw new RuntimeError('Repository::Not::Found', 404);
    res.status(200).json({ status: 'success', data: await listLocalDeployments(repository._id) });
});

export const deleteGithubDeployment = catchAsync(async (req: Request, res: Response) => {
    const { user } = req as any;
    const { repositoryName, deploymentId } = req.params;
    const repository = await Repository.findOne({ name: repositoryName, user: user._id }).select('_id');
    if(!repository)
        throw new RuntimeError('Repository::Not::Found', 404);
    const github = new Github(user, repository);

    await github.deleteRepositoryDeployment(deploymentId).catch(() => undefined);
    await Deployment.deleteOne({ _id: deploymentId, repository: repository._id });
    res.status(200).json({ status: 'success', data: await listLocalDeployments(repository._id) });
});

export const getActiveDeploymentEnvironment = catchAsync(async (req: Request, res: Response) => {
    const { user } = req as any;
    const { repositoryAlias } = req.params;
    const repository = await Repository
        .findOne({ alias: repositoryAlias, user: user._id })
        .select('_id');
    if(!repository)
        throw new RuntimeError('Repository::Not::Found', 404);
    const activeDeployment = await Deployment
        .findOne({ repository: repository._id })
        .sort({ createdAt: -1 })
        .select('_id environment');
    if(!activeDeployment)
        throw new RuntimeError('Deployment::Not::Found', 404);
    const { environment, _id } = activeDeployment as any;
    res.status(200).json({ status: 'success', data: { ...environment, _id } });
});

export default {
    getDeployments,
    getDeployment,
    updateDeployment,
    deleteDeployment,
    repositoryOperations,
    getRepositoryDeployments,
    deleteGithubDeployment,
    getActiveDeploymentEnvironment
};