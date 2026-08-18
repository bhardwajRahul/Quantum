import mongoose from 'mongoose';
import logger from '@utilities/logger';

const ORG = (orgId: mongoose.Types.ObjectId | string) => ({ organization: orgId });

const deleteEachWithHooks = async (modelName: string, filter: Record<string, any>): Promise<number> => {
    let count = 0;
    try{
        const Model = mongoose.model(modelName);
        const docs = await Model.find(filter).select('_id').lean();
        for(const doc of docs){
            try{
                await Model.findOneAndDelete({ _id: (doc as any)._id });
                count++;
            }catch(error){
                logger.error(`@services/tenancy/cascade (deleteEachWithHooks:${modelName}:${(doc as any)._id}): ` + error);
            }
        }
    }catch(error){
        logger.error(`@services/tenancy/cascade (deleteEachWithHooks:${modelName}): ` + error);
    }
    return count;
};

const deleteManySafe = async (modelName: string, filter: Record<string, any>): Promise<number> => {
    try{
        const Model = mongoose.model(modelName);
        const res = await Model.deleteMany(filter);
        return (res as any)?.deletedCount || 0;
    }catch(error){
        logger.error(`@services/tenancy/cascade (deleteManySafe:${modelName}): ` + error);
        return 0;
    }
};

export interface CascadeResult{
    organization: string;
    deleted: Record<string, number>;
}

export const cascadeDeleteOrganization = async (
    organizationId: mongoose.Types.ObjectId | string
): Promise<CascadeResult> => {
    const orgId = organizationId;
    const deleted: Record<string, number> = {};
    const filter = ORG(orgId);

    deleted.repositories = await deleteEachWithHooks('Repository', filter);

    deleted.codespaces = await deleteEachWithHooks('Codespace', filter);

    deleted.databases = await deleteEachWithHooks('Database', filter);

    deleted.templateInstalls = await deleteEachWithHooks('TemplateInstall', filter);

    deleted.dockerContainers = await deleteEachWithHooks('DockerContainer', filter);

    deleted.dockerNetworks = await deleteEachWithHooks('DockerNetwork', filter);

    deleted.dockerImages = await deleteEachWithHooks('DockerImage', filter);

    deleted.portBindings = await deleteManySafe('PortBinding', filter);
    deleted.deployments = await deleteManySafe('Deployment', filter);
    deleted.domains = await deleteManySafe('Domain', filter);
    deleted.healthChecks = await deleteManySafe('HealthCheck', filter);
    deleted.metrics = await deleteManySafe('Metric', filter);

    deleted.analyticsEvents = await deleteManySafe('AnalyticsEvent', filter);
    deleted.analyticsRollups = await deleteManySafe('AnalyticsRollup', filter);

    deleted.activityEvents = await deleteManySafe('ActivityEvent', filter);

    deleted.templates = await deleteManySafe('Template', filter);

    deleted.jobs = await deleteManySafe('Job', { 'target.organization': orgId });

    deleted.environments = await deleteManySafe('Environment', filter);
    deleted.projects = await deleteManySafe('Project', filter);
    deleted.memberships = await deleteManySafe('Membership', filter);

    try{
        await mongoose.model('Organization').findByIdAndDelete(orgId);
        deleted.organization = 1;
    }catch(error){
        logger.error('@services/tenancy/cascade (delete Organization): ' + error);
        deleted.organization = 0;
    }

    try{
        const User = mongoose.model('User');
        const Membership = mongoose.model('Membership');
        const DockerContainer = mongoose.model('DockerContainer');

        const orphanedContainers = await DockerContainer
            .find({ organization: orgId, isUserContainer: true })
            .select('_id').lean();
        if(orphanedContainers.length){
            const ids = orphanedContainers.map((c: any) => c._id);
            await User.updateMany({ container: { $in: ids } }, { $unset: { container: 1 } });
        }

        const affected = await User.find({ defaultOrganization: orgId }).select('_id').lean();
        for(const u of affected){
            const fallback = await Membership.findOne({ user: (u as any)._id, project: null }).select('organization').lean();
            await User.updateOne(
                { _id: (u as any)._id },
                { defaultOrganization: (fallback as any)?.organization || null }
            );
        }
    }catch(error){
        logger.error('@services/tenancy/cascade (repair defaultOrganization): ' + error);
    }

    logger.info(`@services/tenancy/cascade: organization ${orgId} cascade complete — ${JSON.stringify(deleted)}`);
    return { organization: String(orgId), deleted };
};

export interface ProjectCascadeResult{
    project: string;
    deleted: Record<string, number>;
}

export const cascadeDeleteProject = async (
    projectId: mongoose.Types.ObjectId | string
): Promise<ProjectCascadeResult> => {
    const deleted: Record<string, number> = {};
    const filter = { project: projectId };

    deleted.repositories = await deleteEachWithHooks('Repository', filter);
    deleted.codespaces = await deleteEachWithHooks('Codespace', filter);
    deleted.databases = await deleteEachWithHooks('Database', filter);
    deleted.templateInstalls = await deleteEachWithHooks('TemplateInstall', filter);

    deleted.deployments = await deleteManySafe('Deployment', filter);
    deleted.domains = await deleteManySafe('Domain', filter);
    deleted.healthChecks = await deleteManySafe('HealthCheck', filter);
    deleted.metrics = await deleteManySafe('Metric', filter);
    deleted.analyticsRollups = await deleteManySafe('AnalyticsRollup', filter);
    deleted.activityEvents = await deleteManySafe('ActivityEvent', filter);

    deleted.jobs = await deleteManySafe('Job', { 'target.project': projectId });

    deleted.environments = await deleteManySafe('Environment', filter);
    deleted.memberships = await deleteManySafe('Membership', filter);

    try{
        await mongoose.model('Project').findByIdAndDelete(projectId);
        deleted.project = 1;
    }catch(error){
        logger.error('@services/tenancy/cascade (delete Project): ' + error);
        deleted.project = 0;
    }

    logger.info(`@services/tenancy/cascade: project ${projectId} cascade complete — ${JSON.stringify(deleted)}`);
    return { project: String(projectId), deleted };
};

export default cascadeDeleteOrganization;
