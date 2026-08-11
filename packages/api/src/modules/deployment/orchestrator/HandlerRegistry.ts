import { JobType } from '@quantum/contracts/modules/deployment/domain';
import type { JobHandlerMap } from './JobRunner';
import DeployHandler from './handlers/DeployHandler';
import LifecycleHandler from './handlers/LifecycleHandler';
import ReloadHandler from './handlers/ReloadHandler';
import BuildHandler from './handlers/BuildHandler';
import ReconcileHandler from './handlers/ReconcileHandler';
import DatabaseHandler from './handlers/DatabaseHandler';
import CodespaceHandler from './handlers/CodespaceHandler';
import TemplateHandler from './handlers/TemplateHandler';
import HealthHandler from './handlers/HealthHandler';
import MetricsHandler from './handlers/MetricsHandler';
import AnalyticsHandler from './handlers/AnalyticsHandler';
import OrgCascadeHandler from './handlers/OrgCascadeHandler';
import ProjectCascadeHandler from './handlers/ProjectCascadeHandler';

export const buildHandlerMap = (): JobHandlerMap => ({
    [JobType.Deploy]: (job) => new DeployHandler().run(job),
    [JobType.Redeploy]: (job) => new DeployHandler().run(job),
    [JobType.Start]: (job) => new LifecycleHandler().run(job),
    [JobType.Stop]: (job) => new LifecycleHandler().run(job),
    [JobType.Restart]: (job) => new LifecycleHandler().run(job),
    [JobType.Reload]: (job) => new ReloadHandler().run(job),
    [JobType.Build]: (job) => new BuildHandler().run(job),
    [JobType.Reconcile]: () => new ReconcileHandler().run(),
    [JobType.DbProvision]: (job) => new DatabaseHandler().run(job),
    [JobType.DbBackup]: (job) => new DatabaseHandler().run(job),
    [JobType.DbRestore]: (job) => new DatabaseHandler().run(job),
    [JobType.MetricsSample]: (job) => new MetricsHandler().run(job.nodeId),
    [JobType.HealthCheck]: () => new HealthHandler().run(),
    [JobType.TemplateInstall]: (job) => new TemplateHandler().run(job),
    [JobType.TemplateUninstall]: (job) => new TemplateHandler().run(job),
    [JobType.OrgCascadeDelete]: (job) => new OrgCascadeHandler().run(job),
    [JobType.ProjectCascadeDelete]: (job) => new ProjectCascadeHandler().run(job),
    [JobType.AnalyticsSample]: () => new AnalyticsHandler().run(),
    [JobType.CodespaceProvision]: (job) => new CodespaceHandler().run(job),
    [JobType.CodespaceDelete]: (job) => new CodespaceHandler().run(job)
});
