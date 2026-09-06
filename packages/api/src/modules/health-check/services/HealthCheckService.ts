import { eventBus } from '@/shared/events/EventBus';
import { assertOrg } from '@/shared/tenancy';
import Repository from '@/modules/repository/models/Repository';
import HealthCheck from '../models/HealthCheck';
import { HealthCheckError } from '../contracts/domain/errors';
import { HealthCheckStatus, HealthCheckType } from '@quantum/contracts/modules/health-check/domain';
import type { Tenant } from '@/modules/organization/contracts/types/fastify';
import type { CreateHealthCheckInput, UpdateHealthCheckInput } from '@quantum/contracts/modules/health-check/http';

interface RepositoryRef{
    organizationId: number;
    projectId: number;
    userId: number;
}

export default class HealthCheckService{
    async listForRepository(tenant: Tenant, callerId: number, repositoryId: number): Promise<HealthCheck[]>{
        await this.#repositoryFor(tenant, callerId, repositoryId);
        return HealthCheck.find({ where: { repositoryId }, order: { id: 'ASC' } });
    }

    async create(tenant: Tenant, callerId: number, repositoryId: number, input: CreateHealthCheckInput): Promise<HealthCheck>{
        const repository = await this.#repositoryFor(tenant, callerId, repositoryId);
        const healthCheck = await HealthCheck.create({
            organizationId: repository.organizationId,
            repositoryId,
            projectId: repository.projectId,
            userId: repository.userId,
            type: input.type ?? HealthCheckType.Http,
            path: input.path ?? '/',
            port: input.port ?? null,
            command: input.command ?? null,
            intervalSec: input.intervalSec ?? 30,
            timeoutSec: input.timeoutSec ?? 5,
            healthyThreshold: input.healthyThreshold ?? 2,
            unhealthyThreshold: input.unhealthyThreshold ?? 3,
            enabled: input.enabled ?? true,
            autoRestart: input.autoRestart ?? false,
            gateDeploy: input.gateDeploy ?? false,
            status: HealthCheckStatus.Unknown
        }).save();

        this.#notifyChange(healthCheck.id, 'create');
        return healthCheck;
    }

    async getOwned(tenant: Tenant, healthCheckId: number): Promise<HealthCheck>{
        const healthCheck = await HealthCheck.findOneBy({ id: healthCheckId });
        if(!healthCheck) throw HealthCheckError.NotFound();
        assertOrg(tenant, healthCheck.organizationId, HealthCheckError.Forbidden);
        return healthCheck;
    }

    async update(tenant: Tenant, healthCheckId: number, input: UpdateHealthCheckInput): Promise<HealthCheck>{
        const healthCheck = await this.getOwned(tenant, healthCheckId);
        if(input.type !== undefined) healthCheck.type = input.type;
        if(input.path !== undefined) healthCheck.path = input.path;
        if(input.port !== undefined) healthCheck.port = input.port;
        if(input.command !== undefined) healthCheck.command = input.command;
        if(input.intervalSec !== undefined) healthCheck.intervalSec = input.intervalSec;
        if(input.timeoutSec !== undefined) healthCheck.timeoutSec = input.timeoutSec;
        if(input.healthyThreshold !== undefined) healthCheck.healthyThreshold = input.healthyThreshold;
        if(input.unhealthyThreshold !== undefined) healthCheck.unhealthyThreshold = input.unhealthyThreshold;
        if(input.enabled !== undefined) healthCheck.enabled = input.enabled;
        if(input.autoRestart !== undefined) healthCheck.autoRestart = input.autoRestart;
        if(input.gateDeploy !== undefined) healthCheck.gateDeploy = input.gateDeploy;

        const updated = await healthCheck.save();
        this.#notifyChange(updated.id, 'update');
        return updated;
    }

    async remove(tenant: Tenant, healthCheckId: number): Promise<void>{
        const healthCheck = await this.getOwned(tenant, healthCheckId);
        const removedId = healthCheck.id;
        await healthCheck.remove();
        this.#notifyChange(removedId, 'delete');
    }

    async #repositoryFor(tenant: Tenant, callerId: number, repositoryId: number): Promise<RepositoryRef>{
        const repository = await Repository.findOneBy({ id: repositoryId });
        if(!repository) throw HealthCheckError.NotFound();
        if(repository.organizationId === null) throw HealthCheckError.Forbidden();
        if(!tenant.isPlatformAdmin && !this.#canAccess(tenant, callerId, repository)){
            throw HealthCheckError.Forbidden();
        }
        return {
            organizationId: repository.organizationId,
            projectId: repository.projectId,
            userId: repository.userId
        };
    }

    #canAccess(tenant: Tenant, callerId: number, repository: Repository): boolean{
        return repository.userId === callerId || tenant.projectIds.includes(repository.projectId);
    }

    #notifyChange(healthCheckId: number, action: 'create' | 'update' | 'delete'){
        eventBus.emit('healthcheck.changed', { healthCheckId, action });
    }
}
