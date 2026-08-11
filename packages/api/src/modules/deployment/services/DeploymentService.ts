import { In, IsNull } from 'typeorm';
import Deployment from '../models/Deployment';
import Job from '../models/Job';
import Repository from '@/modules/repository/models/Repository';
import RepositoryService from '@/modules/repository/services/RepositoryService';
import OrchestratorService from '../orchestrator/OrchestratorService';
import { DeploymentError } from '../contracts/domain/errors';
import type { Tenant } from '@/modules/organization/contracts/types/fastify';
import type { UpdateDeploymentInput } from '@quantum/contracts/modules/deployment/http';
import type { DeploymentEnvironment, DeploymentAccepted } from '@quantum/contracts/modules/deployment/domain';

const RECENT_JOB_LIMIT = 100;

export default class DeploymentService{
    #repositories = new RepositoryService();
    #orchestrator = new OrchestratorService();

    async listForRepository(userId: number, tenant: Tenant, repositoryId: number): Promise<Deployment[]>{
        await this.#repositories.getOwned(userId, tenant, repositoryId);
        return Deployment.find({
            where: { repositoryId },
            order: { createdAt: 'DESC', id: 'DESC' }
        });
    }

    async getActiveEnvironment(userId: number, tenant: Tenant, repositoryId: number): Promise<DeploymentEnvironment>{
        await this.#repositories.getOwned(userId, tenant, repositoryId);
        const deployment = await Deployment.findOne({
            where: { repositoryId },
            order: { createdAt: 'DESC', id: 'DESC' }
        });
        if(!deployment) throw DeploymentError.NotFound();
        return { deploymentId: deployment.id, environmentVariables: deployment.environmentVariables };
    }

    async getOwned(userId: number, tenant: Tenant, id: number): Promise<Deployment>{
        const deployment = await Deployment.findOneBy({ id });
        if(!deployment) throw DeploymentError.NotFound();
        if(tenant.isPlatformAdmin || deployment.userId === userId) return deployment;
        if(await this.#projectVisible(tenant, deployment.repositoryId)) return deployment;
        throw DeploymentError.Forbidden();
    }

    async updateEnvironmentVariables(deployment: Deployment, input: UpdateDeploymentInput): Promise<Deployment>{
        if(input.environmentVariables !== undefined){
            deployment.environmentVariables = input.environmentVariables;
        }
        return deployment.save();
    }

    async operation(userId: number, tenant: Tenant, repositoryId: number, operation: 'start' | 'stop' | 'restart'): Promise<DeploymentAccepted>{
        const repository = await this.#repositories.getOwned(userId, tenant, repositoryId);
        const job = await this.#orchestrator.lifecycle(repository.id, operation, userId);
        return { jobId: job.id, status: job.status, action: operation };
    }

    async remove(deployment: Deployment): Promise<void>{
        await deployment.remove();
    }

    listAll(): Promise<Deployment[]>{
        return Deployment.find({ order: { id: 'DESC' } });
    }

    async listJobs(userId: number, tenant: Tenant): Promise<Job[]>{
        if(tenant.isPlatformAdmin){
            return Job.find({ order: { id: 'DESC' }, take: RECENT_JOB_LIMIT });
        }
        const organizationIds = tenant.organizationIds.length > 0 ? tenant.organizationIds : [0];
        return Job.find({
            where: [
                { organizationId: In(organizationIds) },
                { userId, organizationId: IsNull() }
            ],
            order: { id: 'DESC' },
            take: RECENT_JOB_LIMIT
        });
    }

    async #projectVisible(tenant: Tenant, repositoryId: number): Promise<boolean>{
        const repository = await Repository.findOneBy({ id: repositoryId });
        return repository !== null && tenant.projectIds.includes(repository.projectId);
    }
}
