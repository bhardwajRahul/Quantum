import { IJob } from '@typings/models/job';
import { runLifecycle } from '@services/orchestrator/handlers/lifecycleHandler';
import { runDeploy } from '@services/orchestrator/handlers/deployHandler';
import { runReconcile } from '@services/orchestrator/handlers/reconcileHandler';

export const dispatch = async (job: IJob): Promise<void> => {
    switch(job.type){
        case 'deploy':
        case 'redeploy':
            await runDeploy(job);
            return;
        case 'start':
        case 'stop':
        case 'restart':
            await runLifecycle(job);
            return;
        case 'reconcile':
            await runReconcile(job);
            return;
        case 'reload':
            await (await import('@services/orchestrator/handlers/reloadHandler')).runReload(job);
            return;
        case 'build':
            await (await import('@services/orchestrator/handlers/buildHandler')).runBuild(job);
            return;
        case 'db:provision':
        case 'db:backup':
        case 'db:restore':
            await (await import('@services/orchestrator/handlers/databaseHandler')).runDatabaseJob(job);
            return;
        case 'metrics:sample':
            await (await import('@services/orchestrator/handlers/metricsHandler')).runMetricsSample(job);
            return;
        case 'health:check':
            await (await import('@services/orchestrator/handlers/healthHandler')).runHealthCheck(job);
            return;
        case 'template:install':
        case 'template:uninstall':
            await (await import('@services/orchestrator/handlers/templateHandler')).runTemplateJob(job);
            return;
        case 'org:cascade-delete':
            await (await import('@services/orchestrator/handlers/orgCascadeHandler')).runOrgCascadeDelete(job);
            return;
        case 'project:cascade-delete':
            await (await import('@services/orchestrator/handlers/projectCascadeHandler')).runProjectCascadeDelete(job);
            return;
        case 'analytics:sample':
            await (await import('@services/orchestrator/handlers/analyticsHandler')).runAnalyticsSample(job);
            return;
        case 'codespace:provision':
        case 'codespace:delete':
            await (await import('@services/orchestrator/handlers/codespaceHandler')).runCodespaceJob(job);
            return;
        default:
            throw new Error(`Orchestrator::Dispatch::UnknownJobType::${job.type}`);
    }
};

export default dispatch;
