import TemplateInstall from '@models/templateInstall';
import Template from '@models/template';
import DockerContainer from '@models/docker/container';
import DockerNetwork from '@models/docker/network';
import { ensureInstallInfra, collectPortBindings } from '@services/templates/installer';
import { resolveEnv } from '@services/templates/interpolate';
import { decrypt } from '@utilities/encryption';
import { emitDeploymentStatus } from '@services/orchestrator/events';
import { activityContextFromJob, ActivityContext } from '@services/activity';
import DockerContainerService from '@services/docker/container';
import logger from '@utilities/logger';
import { IJob } from '@typings/models/job';
import { TemplateSpec, TemplateServiceSpec } from '@typings/models/template';
import { ITemplateInstall } from '@typings/models/templateInstall';

const resolveSpec = async (install: ITemplateInstall): Promise<TemplateSpec> => {
    if(install.template){
        const template = await Template.findOne({
            _id: install.template,
            version: install.templateVersion
        }) || await Template.findById(install.template);
        if(!template){
            throw new Error(`Template::Job::TemplateNotFound::${install.template}`);
        }
        return template.spec as TemplateSpec;
    }
    const embedded = install.inputs.get('__spec__');
    if(embedded){
        return JSON.parse(decrypt(embedded)) as TemplateSpec;
    }
    throw new Error('Template::Job::SpecUnavailable');
};

const decryptInputs = (install: ITemplateInstall): Record<string, string> => {
    const out: Record<string, string> = {};
    for(const [key, value] of install.inputs.entries()){
        if(key === '__spec__') continue;
        try{
            out[key] = decrypt(value);
        }catch(error){

            out[key] = value;
        }
    }
    return out;
};

const inferEngine = (service: TemplateServiceSpec): string | null => {
    const known = ['postgres', 'mysql', 'mariadb', 'mongodb', 'redis'];
    if(service.engine && known.includes(service.engine)) return service.engine;
    const image = (service.image || '').toLowerCase();
    if(image.includes('postgres') || image.includes('postgis')) return 'postgres';
    if(image.includes('mariadb')) return 'mariadb';
    if(image.includes('mysql')) return 'mysql';
    if(image.includes('mongo')) return 'mongodb';
    if(image.includes('redis')) return 'redis';
    return null;
};

const maybeRouteManagedDatabases = async (
    install: ITemplateInstall,
    spec: TemplateSpec
): Promise<Set<string>> => {
    const handled = new Set<string>();
    if(process.env.TEMPLATES_MANAGED_DB !== 'true') return handled;

    try{
        const [{ default: Database }, orchestrator] = await Promise.all([
            import('@models/database'),
            import('@services/orchestrator')
        ]);
        for(const [serviceName, service] of Object.entries(spec.services)){
            if(service.kind !== 'database') continue;
            const engine = inferEngine(service);
            if(!engine) continue;
            const already = install.services.find((s) => s.name === serviceName && s.role === 'database');
            if(already?.container){ handled.add(serviceName); continue; }

            const database = await (Database as any).create({
                name: `${install.name}-${serviceName}`.toLowerCase().replace(/[^a-z0-9_.-]/g, '-'),
                engine,
                project: install.project,
                environment: install.environment,
                user: install.user,
                nodeId: install.nodeId,
                status: 'pending'
            });
            await orchestrator.enqueueDatabaseJob('db:provision', database._id.toString(), {
                userId: install.user?.toString(),
                projectId: install.project?.toString()
            });
            install.services.push({ name: serviceName, container: undefined as any, role: 'database' });
            handled.add(serviceName);
        }
        if(handled.size) await install.save();
    }catch(error){
        logger.warn('@services/orchestrator/handlers/templateHandler.ts (maybeRouteManagedDatabases): falling back to containers: ' + error);
        return new Set<string>();
    }
    return handled;
};

const applyResolvedEnvironment = async (
    spec: TemplateSpec,
    inputs: Record<string, string>,
    containers: Record<string, any>
): Promise<void> => {
    const ports = await collectPortBindings(containers);
    const resolved = resolveEnv(spec, inputs, ports);
    for(const [serviceName, container] of Object.entries(containers)){
        const variables = resolved[serviceName];
        if(!variables || Object.keys(variables).length === 0) continue;

        const updated = await DockerContainer.findOneAndUpdate(
            { _id: container._id },
            { environment: { variables } },
            { new: true }
        );
        if(updated){
            await new DockerContainerService(updated).reloadContainer();
        }
    }
};

const registerIngress = async (
    install: ITemplateInstall,
    spec: TemplateSpec,
    containers: Record<string, any>
): Promise<void> => {
    if(process.env.INGRESS_ENABLED === 'false') return;
    try{
        const { getIngressLabels } = await import('@services/ingress');
        for(const [serviceName, service] of Object.entries(spec.services)){
            if(!service.expose?.http) continue;
            const container = containers[serviceName];
            if(!container) continue;

            const labels = await getIngressLabels({
                _id: container._id,
                alias: `${install.name}-${serviceName}`,
                port: service.expose.port || service.ports?.[0]?.target,
                runtime: undefined
            } as any);
            if(labels && Object.keys(labels).length > 0){
                const svc = new DockerContainerService(container);
                await svc.reloadContainer({ extraLabels: labels });
            }
        }
    }catch(error){
        logger.warn('@services/orchestrator/handlers/templateHandler.ts (registerIngress): ' + error);
    }
};

const runInstall = async (install: ITemplateInstall, act: ActivityContext): Promise<void> => {
    const spec = await act.step('Resolving template', () => resolveSpec(install));

    install.status = 'installing';
    await install.save();

    await act.step('Provisioning services', async () => {

        const managed = await maybeRouteManagedDatabases(install, spec);

        const containers = await ensureInstallInfra(install, spec, { skipServices: managed });

        const inputs = decryptInputs(install);
        await applyResolvedEnvironment(spec, inputs, containers);
        return containers;
    }).then((containers) =>

        act.step('Wiring network/ingress', () => registerIngress(install, spec, containers)));

    install.status = 'running';
    await install.save();
};

const runUninstall = async (install: ITemplateInstall, act: ActivityContext): Promise<void> => {
    await act.step('Removing template services', async () => {

        for(const service of install.services){
            if(!service.container) continue;
            try{
                await DockerContainer.findOneAndDelete({ _id: service.container });
            }catch(error){
                logger.warn(`@services/orchestrator/handlers/templateHandler.ts (runUninstall): container ${service.container}: ${error}`);
            }
        }

        if(install.network){
            try{
                await DockerNetwork.findOneAndDelete({ _id: install.network });
            }catch(error){
                logger.warn(`@services/orchestrator/handlers/templateHandler.ts (runUninstall): network ${install.network}: ${error}`);
            }
        }
    });
    install.status = 'removed';
    install.services = [] as any;
    await install.save();
};

export const runTemplateJob = async (job: IJob): Promise<void> => {
    const installId = (job.target?.service || job.payload?.installId)?.toString();
    if(!installId){
        throw new Error('Template::Job::MissingInstallId');
    }
    const install = await TemplateInstall.findById(installId);
    if(!install){
        throw new Error(`Template::Job::InstallNotFound::${installId}`);
    }
    const userId = (job.target?.user || install.user)?.toString();

    if((install as any).organization) job.target.organization = (install as any).organization;
    const act = activityContextFromJob(job);

    try{
        if(job.type === 'template:install'){
            await runInstall(install, act);
        }else if(job.type === 'template:uninstall'){
            await runUninstall(install, act);
        }else{
            throw new Error(`Template::Job::UnknownType::${job.type}`);
        }
        emitDeploymentStatus(userId, { status: install.status, jobId: job._id.toString() });
        act.success(job.type === 'template:uninstall'
            ? `Template "${install.name}" removed`
            : `Template "${install.name}" installed`);
    }catch(error){
        logger.error(`@services/orchestrator/handlers/templateHandler.ts (runTemplateJob): ${job.type} ${installId}: ${error}`);
        act.fail(`Template job ${job.type} failed`, error);
        if(job.type === 'template:install'){
            install.status = 'failed';
            await install.save().catch(() => undefined);
        }
        emitDeploymentStatus(userId, { status: 'failed', jobId: job._id.toString() });

        throw error;
    }
};

export default runTemplateJob;
