import { In } from 'typeorm';
import Repository from '@/modules/repository/models/Repository';
import Deployment from '../models/Deployment';
import DockerContainer from '@/modules/docker/models/DockerContainer';
import DockerNetwork from '@/modules/docker/models/DockerNetwork';
import DockerImage from '@/modules/docker/models/DockerImage';
import HealthCheck from '@/modules/health-check/models/HealthCheck';
import Database from '@/modules/database/models/Database';
import TemplateInstall from '@/modules/template/models/TemplateInstall';
import RegistryCredential from '@/modules/registry/models/RegistryCredential';
import Metric from '@/modules/metric/models/Metric';
import PortBinding from '@/modules/docker/models/PortBinding';
import ContainerOps from './ContainerOps';
import { teardownNetwork } from './NetworkOps';
import { logger } from '@/shared/utils/Logger';

type DeleteFn = () => Promise<{ affected?: number | null }>;

export default class CascadeService{
    async deleteByOrganization(organizationId: number): Promise<Record<string, number>>{
        const deleted: Record<string, number> = {};
        await this.#teardownContainers({ organizationId });
        deleted.networks = await this.#teardownNetworks(organizationId);
        deleted.repositories = await this.#safe(() => Repository.delete({ organizationId }));
        deleted.deployments = await this.#safe(() => Deployment.delete({ organizationId }));
        deleted.healthChecks = await this.#safe(() => HealthCheck.delete({ organizationId }));
        deleted.databases = await this.#safe(() => Database.delete({ organizationId }));
        deleted.templateInstalls = await this.#safe(() => TemplateInstall.delete({ organizationId }));
        deleted.registryCredentials = await this.#safe(() => RegistryCredential.delete({ organizationId }));
        deleted.metrics = await this.#safe(() => Metric.delete({ organizationId }));
        deleted.portBindings = await this.#safe(() => PortBinding.delete({ organizationId }));
        deleted.images = await this.#safe(() => DockerImage.delete({ organizationId }));
        logger.info(`organization ${organizationId} cascade complete`, { scope: 'orchestrator.cascade' });
        return deleted;
    }

    async deleteByProject(projectId: number): Promise<Record<string, number>>{
        const deleted: Record<string, number> = {};
        await this.#teardownContainers({ projectId });
        const repositoryIds = await this.#repositoryIds(projectId);
        deleted.repositories = await this.#safe(() => Repository.delete({ projectId }));
        deleted.deployments = repositoryIds.length === 0
            ? 0
            : await this.#safe(() => Deployment.delete({ repositoryId: In(repositoryIds) }));
        deleted.healthChecks = await this.#safe(() => HealthCheck.delete({ projectId }));
        deleted.databases = await this.#safe(() => Database.delete({ projectId }));
        deleted.templateInstalls = await this.#safe(() => TemplateInstall.delete({ projectId }));
        deleted.metrics = await this.#safe(() => Metric.delete({ projectId }));
        logger.info(`project ${projectId} cascade complete`, { scope: 'orchestrator.cascade' });
        return deleted;
    }

    async #repositoryIds(projectId: number): Promise<number[]>{
        const repositories = await Repository.find({ where: { projectId }, select: { id: true } });
        return repositories.map((repository) => repository.id);
    }

    async #teardownContainers(scope: { organizationId: number } | { projectId: number }): Promise<void>{
        const containers = await this.#containersFor(scope);
        for(const container of containers){
            try{
                await new ContainerOps(container).removeContainer();
            }catch{
                logger.warn(`cascade: could not remove container ${container.dockerContainerName}`, { scope: 'orchestrator.cascade' });
            }
        }
        if('organizationId' in scope){
            await this.#safe(() => DockerContainer.delete({ organizationId: scope.organizationId }));
            return;
        }
        const repositoryIds = await this.#repositoryIds(scope.projectId);
        if(repositoryIds.length > 0){
            await this.#safe(() => DockerContainer.delete({ repositoryId: In(repositoryIds) }));
        }
    }

    async #containersFor(scope: { organizationId: number } | { projectId: number }): Promise<DockerContainer[]>{
        if('organizationId' in scope) return DockerContainer.find({ where: { organizationId: scope.organizationId } });
        const repositoryIds = await this.#repositoryIds(scope.projectId);
        if(repositoryIds.length === 0) return [];
        return DockerContainer.find({ where: { repositoryId: In(repositoryIds) } });
    }

    async #teardownNetworks(organizationId: number): Promise<number>{
        const networks = await DockerNetwork.find({ where: { organizationId } });
        for(const network of networks){
            await teardownNetwork(network).catch(() => undefined);
        }
        await this.#safe(() => DockerNetwork.delete({ organizationId }));
        return networks.length;
    }

    async #safe(fn: DeleteFn): Promise<number>{
        try{
            const result = await fn();
            return result.affected ?? 0;
        }catch(error){
            logger.warn(`cascade delete failed: ${(error as Error).message}`, { scope: 'orchestrator.cascade' });
            return 0;
        }
    }
}
