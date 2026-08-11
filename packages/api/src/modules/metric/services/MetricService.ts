import { MoreThanOrEqual } from 'typeorm';
import { config } from '@/shared/config';
import Metric from '../models/Metric';
import DockerContainer from '@/modules/docker/models/DockerContainer';
import { MetricError } from '../contracts/domain/errors';
import type { FindOptionsWhere } from 'typeorm';
import type { Tenant } from '@/modules/organization/contracts/types/fastify';

const MAX_WINDOW = 1000;
const DEFAULT_LIMIT = 200;
const DEFAULT_MINUTES = 60;

interface RepositoryOrgRow{
    organizationId: number;
}

export default class MetricService{
    async byContainer(tenant: Tenant, containerId: number, limit: string | undefined, minutes: string | undefined): Promise<Metric[]>{
        const container = await DockerContainer.findOneBy({ id: containerId });
        if(!container) throw MetricError.NotFound();
        if(!tenant.isPlatformAdmin && !tenant.organizationIds.includes(container.organizationId)){
            throw MetricError.Forbidden();
        }
        return this.#window({ containerId }, limit, minutes);
    }

    async byRepository(tenant: Tenant, repositoryId: number, limit: string | undefined, minutes: string | undefined): Promise<Metric[]>{
        const organizationId = await this.#repositoryOrganizationId(repositoryId);
        if(organizationId === null) throw MetricError.NotFound();
        if(!tenant.isPlatformAdmin && !tenant.organizationIds.includes(organizationId)){
            throw MetricError.Forbidden();
        }
        return this.#window({ repositoryId }, limit, minutes);
    }

    async #window(where: FindOptionsWhere<Metric>, rawLimit: string | undefined, rawMinutes: string | undefined): Promise<Metric[]>{
        const limit = Math.min(Number(rawLimit) || DEFAULT_LIMIT, MAX_WINDOW);
        const since = new Date(Date.now() - (Number(rawMinutes) || DEFAULT_MINUTES) * 60 * 1000);
        return Metric.find({
            where: { ...where, ts: MoreThanOrEqual(since) },
            order: { ts: 'DESC' },
            take: limit
        });
    }

    async #repositoryOrganizationId(repositoryId: number): Promise<number | null>{
        const rows: RepositoryOrgRow[] = await Metric.query(
            `SELECT "organizationId" FROM ${this.#qualify('repository')} WHERE id = $1 LIMIT 1`,
            [repositoryId]
        );
        return rows.length > 0 ? rows[0].organizationId : null;
    }

    #qualify(table: string): string{
        return config.databaseSchema === undefined ? table : `"${config.databaseSchema}".${table}`;
    }
}
