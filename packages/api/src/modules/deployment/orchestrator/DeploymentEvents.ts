import { DefineEventGroup, Event } from '@/shared/events/EventGroup';
import { eventBus } from '@/shared/events/EventBus';
import OrchestratorService from './OrchestratorService';
import IngressHandler from './handlers/IngressHandler';
import Repository from '@/modules/repository/models/Repository';
import { startOrchestrator } from './bootstrap';
import { JobType } from '@quantum/contracts/modules/deployment/domain';
import { writeUpstreamConfig } from '@/modules/domain/services/UpstreamRouterFile';
import { logger } from '@/shared/utils/Logger';
import type { DeployOptions } from './OrchestratorService';
import type { DeploymentRequestedPayload, DeploymentRollbackRequestedPayload } from '@/modules/repository/contracts/domain/events';
import type { TemplateInstalledPayload, TemplateUninstalledPayload } from '@/modules/template/contracts/domain/events';
import type { DatabaseProvisionRequestedPayload } from '@/modules/database/contracts/domain/events';
import type { HealthCheckChangedPayload } from '@/modules/health-check/contracts/domain/events';
import type { DomainCreatedPayload, DomainDeletedPayload } from '@/modules/domain/contracts/domain/events';
import type { OrganizationDeletedPayload } from '@/modules/organization/contracts/domain/events';
import type { ProjectDeletedPayload } from '@/modules/project/contracts/domain/events';
import type { UserDeletedPayload } from '@/modules/user/contracts/domain/events';
import type { GithubConnectedPayload, GithubDisconnectedPayload } from '@/modules/github/contracts/domain/events';

type DbJobType = JobType.DbProvision | JobType.DbBackup | JobType.DbRestore | JobType.DbDelete;

const DB_ACTION_TO_JOB: Record<string, DbJobType | undefined> = {
    create: JobType.DbProvision,
    backup: JobType.DbBackup,
    restore: JobType.DbRestore,
    delete: JobType.DbDelete
};

@DefineEventGroup('deployment')
export default class DeploymentEvents{
    #orchestrator = new OrchestratorService();
    #ingress = new IngressHandler();

    constructor(){
        startOrchestrator();
        eventBus.subscribe('template.installed', (payload) => this.#templateInstalled(payload as TemplateInstalledPayload));
        eventBus.subscribe('template.uninstalled', (payload) => this.#templateUninstalled(payload as TemplateUninstalledPayload));
        eventBus.subscribe('database.provisionRequested', (payload) => this.#databaseProvision(payload as DatabaseProvisionRequestedPayload));
        eventBus.subscribe('healthcheck.changed', (payload) => this.#healthCheckChanged(payload as HealthCheckChangedPayload));
        eventBus.subscribe('domain.created', (payload) => this.#domainChanged(payload as DomainCreatedPayload));
        eventBus.subscribe('domain.deleted', (payload) => this.#domainChanged(payload as DomainDeletedPayload));
        eventBus.subscribe('organization.deleted', (payload) => this.#organizationDeleted(payload as OrganizationDeletedPayload));
        eventBus.subscribe('project.deleted', (payload) => this.#projectDeleted(payload as ProjectDeletedPayload));
        eventBus.subscribe('user.deleted', (payload) => this.#userDeleted(payload as UserDeletedPayload));
        eventBus.subscribe('github.connected', (payload) => this.#githubConnected(payload as GithubConnectedPayload));
        eventBus.subscribe('github.disconnected', (payload) => this.#githubDisconnected(payload as GithubDisconnectedPayload));
    }

    @Event('requested')
    requested(payload: DeploymentRequestedPayload): Promise<unknown>{
        const options: DeployOptions = {
            reason: payload.reason as DeployOptions['reason'],
            commit: payload.commit ?? undefined,
            userId: payload.userId ?? undefined
        };
        return this.#orchestrator.deploy(payload.repositoryId, options);
    }

    @Event('rollbackRequested')
    rollbackRequested(payload: DeploymentRollbackRequestedPayload): Promise<unknown>{
        return this.#orchestrator.deploy(payload.repositoryId, {
            reason: 'rollback',
            rollbackTo: payload.deploymentId,
            userId: payload.userId
        });
    }

    #templateInstalled(payload: TemplateInstalledPayload): Promise<unknown>{
        return this.#orchestrator.templateJob(JobType.TemplateInstall, payload.templateInstallId, {
            userId: payload.userId,
            projectId: payload.projectId
        });
    }

    #templateUninstalled(payload: TemplateUninstalledPayload): Promise<unknown>{
        return this.#orchestrator.templateJob(JobType.TemplateUninstall, payload.templateInstallId, {
            userId: payload.userId ?? undefined,
            payload: { services: payload.services, networkId: payload.networkId }
        });
    }

    #databaseProvision(payload: DatabaseProvisionRequestedPayload): Promise<unknown> | undefined{
        const type = DB_ACTION_TO_JOB[payload.action];
        if(!type) return undefined;
        return this.#orchestrator.databaseJob(type, payload.databaseId, {
            userId: payload.userId,
            backupId: payload.backupId,
            containerId: payload.containerId
        });
    }

    #healthCheckChanged(_payload: HealthCheckChangedPayload): Promise<unknown>{
        return this.#orchestrator.healthCheck();
    }

    async #domainChanged(payload: { repositoryId: number | null }): Promise<void>{
        await writeUpstreamConfig();

        if(payload.repositoryId === null) return;
        const repository = await Repository.findOneBy({ id: payload.repositoryId });
        if(!repository) return;
        await this.#ingress.applyIngress(repository).catch((error) =>
            logger.error('ingress sync on domain change failed', error, { scope: 'deployment.events' }));
    }

    #organizationDeleted(payload: OrganizationDeletedPayload): Promise<unknown>{
        return this.#orchestrator.orgCascadeDelete(payload.organizationId);
    }

    #projectDeleted(payload: ProjectDeletedPayload): Promise<unknown>{
        return this.#orchestrator.projectCascadeDelete(payload.projectId);
    }

    #userDeleted(payload: UserDeletedPayload): void{
        logger.info(`user ${payload.userId} deleted; user-level cascade deferred (no legacy user cascade job)`, { scope: 'deployment.events' });
    }

    #githubConnected(payload: GithubConnectedPayload): void{
        logger.debug(`github connected for user ${payload.userId}`, { scope: 'deployment.events' });
    }

    #githubDisconnected(payload: GithubDisconnectedPayload): void{
        logger.debug(`github disconnected for user ${payload.userId}`, { scope: 'deployment.events' });
    }
}
