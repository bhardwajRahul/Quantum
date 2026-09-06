import { MoreThanOrEqual } from 'typeorm';
import { assertOrg } from '@/shared/tenancy';
import { config } from '@/shared/config';
import Metric from '../models/Metric';
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
    async byRepository(tenant: Tenant, repositoryId: number, limit: string | number | undefined, minutes: string | number | undefined): Promise<Metric[]>{
        const organizationId = await this.#repositoryOrganizationId(repositoryId);
        if(organizationId === null) throw MetricError.NotFound();
        assertOrg(tenant, organizationId, MetricError.Forbidden);
        return this.#window({ repositoryId }, limit, minutes);
    }

    async #window(where: FindOptionsWhere<Metric>, rawLimit: string | number | undefined, rawMinutes: string | number | undefined): Promise<Metric[]>{
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
