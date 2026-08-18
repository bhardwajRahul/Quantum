import mongoose from 'mongoose';
import Organization from '@models/organization';
import Project from '@models/project';
import Environment from '@models/environment';
import DockerContainer from '@models/docker/container';
import DockerImage from '@models/docker/image';
import DockerNetwork from '@models/docker/network';
import logger from '@utilities/logger';
import { IUser } from '@typings/models/user';
import { IProject } from '@typings/models/project';
import { IEnvironment } from '@typings/models/environment';
import { IDockerContainer } from '@typings/models/docker/container';

export const ensureOrgDefaults = async (
    organizationId: mongoose.Types.ObjectId | string
): Promise<{ project: IProject; environment: IEnvironment }> => {

    let project = await Project.findOne({ organization: organizationId, slug: 'default' })
        ?? await Project.findOne({ organization: organizationId, isDefault: true });
    if(!project){
        project = await Project.create({
            name: 'Default',
            slug: 'default',
            organization: organizationId,
            isDefault: true
        });
    }

    let environment = await Environment.findOne({ project: project._id, isDefault: true })
        ?? await Environment.findOne({ project: project._id, name: 'production' });
    if(!environment){
        environment = await Environment.create({
            name: 'production',
            type: 'production',
            organization: organizationId,
            project: project._id,
            isDefault: true
        });
    }

    return { project, environment };
};

export const createUserContainer = async (
    user: IUser,
    orgId: mongoose.Types.ObjectId | string
): Promise<IDockerContainer | null> => {
    try{
        const User = mongoose.model<IUser>('User');
        if(user.container){
            const existing = await DockerContainer.findById(user.container);
            if(existing) return existing as IDockerContainer;
        }
        const userId = user._id.toString();
        const image = await DockerImage.create({ name: 'alpine', tag: 'latest', user: userId, organization: orgId });
        const network = await DockerNetwork.create({ user: userId, organization: orgId, driver: 'bridge', name: userId });
        const container = await DockerContainer.create({
            name: userId,
            user: userId,
            organization: orgId,
            image: image._id,
            network: network._id,
            command: '/bin/sh',
            isUserContainer: true
        });

        await User.updateOne(
            { _id: user._id },
            {
                container: container._id,
                $push: { images: image._id, networks: network._id, containers: container._id }
            }
        );

        user.container = container._id as any;
        (user.images as any)?.push?.(image._id);
        (user.networks as any)?.push?.(network._id);
        (user.containers as any)?.push?.(container._id);
        return container as IDockerContainer;
    }catch(error){
        logger.error('@services/tenancy/provisioning.ts (createUserContainer): ' + error);
        return null;
    }
};

interface BackfillResult{
    usersProvisioned: number;
    reposBackfilled: number;

    orgBackfilled: Record<string, number>;
    projectBackfilled: Record<string, number>;
}

const backfillOrgFromParent = async (
    childModelName: string,
    parentField: string,
    parentModelName: string,
    parentOrgField: string
): Promise<number> => {
    let count = 0;
    try{
        const ChildModel = mongoose.model(childModelName);

        const docs = await ChildModel.find({
            $or: [
                { organization: { $exists: false } },
                { organization: null }
            ]
        }).select(parentField);
        if(docs.length === 0) return 0;

        const ParentModel = mongoose.model(parentModelName);

        const orgCache = new Map<string, mongoose.Types.ObjectId | null>();

        for(const doc of docs){
            const parentId = (doc as any)[parentField];
            if(!parentId) continue;
            const parentKey = parentId.toString();
            let orgId = orgCache.get(parentKey);
            if(orgId === undefined){
                const parent = await ParentModel.findById(parentId).select(parentOrgField).lean();
                const resolved: mongoose.Types.ObjectId | null =
                    parent ? (((parent as any)[parentOrgField] as mongoose.Types.ObjectId) ?? null) : null;
                orgId = resolved;
                orgCache.set(parentKey, resolved);
            }
            if(!orgId) continue;

            await ChildModel.updateOne({ _id: doc._id }, { organization: orgId }, { strict: false });
            count++;
        }
    }catch(error){
        logger.error(`@services/tenancy/provisioning.ts (backfillOrgFromParent:${childModelName}): ` + error);
    }
    return count;
};

const backfillRepositories = async (): Promise<number> => {
    const User = mongoose.model<IUser>('User');
    const Repository = mongoose.model('Repository');
    let reposBackfilled = 0;
    const repositories = await Repository.find({
        $or: [
            { project: { $exists: false } },
            { project: null }
        ]
    });
    for(const repository of repositories){
        const ownerId = (repository as any).user;
        if(!ownerId){
            logger.error(`@services/tenancy/provisioning.ts (backfillRepositories): Repository ${repository._id} has no owner; skipping.`);
            continue;
        }
        const owner = await User.findById(ownerId);
        if(!owner){
            logger.error(`@services/tenancy/provisioning.ts (backfillRepositories): Owner ${ownerId} for repository ${repository._id} not found; skipping.`);
            continue;
        }

        const orgId = (owner as any).defaultOrganization;
        if(!orgId) continue;

        const { project, environment } = await ensureOrgDefaults(orgId);
        const update: Record<string, unknown> = {
            organization: orgId,
            project: project._id,
            environment: environment._id
        };
        if(!(repository as any).sourceType){
            update.sourceType = 'github';
        }

        await Repository.updateOne({ _id: repository._id }, update, { strict: false });
        reposBackfilled++;
    }
    return reposBackfilled;
};

const backfillProjectFromParent = async (
    childModelName: string,
    parentField: string,
    parentModelName: string
): Promise<number> => {
    let count = 0;
    try{
        const ChildModel = mongoose.model(childModelName);
        const docs = await ChildModel.find({
            $or: [
                { project: { $exists: false } },
                { project: null }
            ]
        }).select(parentField);
        if(docs.length === 0) return 0;

        const ParentModel = mongoose.model(parentModelName);
        const projectCache = new Map<string, mongoose.Types.ObjectId | null>();

        for(const doc of docs){
            const parentId = (doc as any)[parentField];
            if(!parentId) continue;
            const parentKey = parentId.toString();
            let projectId = projectCache.get(parentKey);
            if(projectId === undefined){
                const parent = await ParentModel.findById(parentId).select('project').lean();
                projectId = parent ? (((parent as any).project as mongoose.Types.ObjectId) ?? null) : null;
                projectCache.set(parentKey, projectId);
            }
            if(!projectId) continue;

            await ChildModel.updateOne({ _id: doc._id }, { project: projectId }, { strict: false });
            count++;
        }
    }catch(error){
        logger.error(`@services/tenancy/provisioning.ts (backfillProjectFromParent:${childModelName}): ` + error);
    }
    return count;
};

const ORG_STAMP_PASSES: ReadonlyArray<readonly [string, string, string, string]> = [
    ['Deployment', 'repository', 'Repository', 'organization'],
    ['Domain', 'repository', 'Repository', 'organization'],
    ['HealthCheck', 'repository', 'Repository', 'organization'],
    ['Database', 'project', 'Project', 'organization'],
    ['Environment', 'project', 'Project', 'organization'],
    ['DockerContainer', 'user', 'User', 'defaultOrganization'],
    ['DockerImage', 'user', 'User', 'defaultOrganization'],
    ['DockerNetwork', 'user', 'User', 'defaultOrganization'],
    ['PortBinding', 'user', 'User', 'defaultOrganization'],
    ['Metric', 'container', 'DockerContainer', 'organization']
];

const PROJECT_STAMP_PASSES: ReadonlyArray<readonly [string, string, string]> = [
    ['Deployment', 'repository', 'Repository'],
    ['Domain', 'repository', 'Repository'],
    ['HealthCheck', 'repository', 'Repository']
];

export const runTenancyBackfill = async (): Promise<BackfillResult> => {

    const usersProvisioned = 0;
    let reposBackfilled = 0;
    const orgBackfilled: Record<string, number> = {};
    const projectBackfilled: Record<string, number> = {};

    try{
        reposBackfilled = await backfillRepositories();

        for(const [child, parentField, parentModel, parentOrgField] of ORG_STAMP_PASSES){
            orgBackfilled[child] = await backfillOrgFromParent(child, parentField, parentModel, parentOrgField);
        }

        for(const [child, parentField, parentModel] of PROJECT_STAMP_PASSES){
            projectBackfilled[child] = await backfillProjectFromParent(child, parentField, parentModel);
        }

        const orgSummary = Object.entries(orgBackfilled)
            .map(([name, n]) => `${name}=${n}`)
            .join(', ');
        const projectSummary = Object.entries(projectBackfilled)
            .map(([name, n]) => `${name}=${n}`)
            .join(', ');
        logger.info(`@services/tenancy/provisioning.ts (runTenancyBackfill): Provisioned ${usersProvisioned} user(s), backfilled ${reposBackfilled} repository(ies). Organization stamped: ${orgSummary}. Project stamped: ${projectSummary}.`);
    }catch(error){
        logger.error('@services/tenancy/provisioning.ts (runTenancyBackfill): ' + error);
    }

    return { usersProvisioned, reposBackfilled, orgBackfilled, projectBackfilled };
};
