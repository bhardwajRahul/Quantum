import { config } from '@/shared/config';
import Metric from '@/modules/metric/models/Metric';
import type { Tenant } from '@/modules/organization/contracts/types/fastify';
import type { NetworkUsageStat, ResourceUsageStat } from '@quantum/contracts/modules/docker/domain';

const MAX_MINUTES = 43200;
const DEFAULT_MINUTES = 1440;

interface UsageRow{
    projectId: number;
    projectName: string | null;
    incoming?: string | number;
    outgoing?: string | number;
    avgCpu?: string | number;
    avgMem?: string | number;
    maxMem?: string | number;
}

export default class UsageService{
    async network(tenant: Tenant, rawMinutes: string | undefined): Promise<NetworkUsageStat[]>{
        const rows: UsageRow[] = await Metric.query(`
            WITH per_container AS (
                SELECT "containerId", "projectId",
                       MAX("netRx") - MIN("netRx") AS incoming,
                       MAX("netTx") - MIN("netTx") AS outgoing
                FROM ${this.#qualify('metric')}
                WHERE "organizationId" = ANY($1) AND ts >= $2 AND "projectId" IS NOT NULL
                GROUP BY "containerId", "projectId"
            )
            SELECT pc."projectId" AS "projectId", p.name AS "projectName",
                   SUM(pc.incoming) AS incoming, SUM(pc.outgoing) AS outgoing
            FROM per_container pc
            LEFT JOIN ${this.#qualify('project')} p ON p.id = pc."projectId"
            GROUP BY pc."projectId", p.name
            ORDER BY outgoing DESC, incoming DESC
        `, this.#params(tenant, rawMinutes));

        return rows.map((row) => ({
            projectId: row.projectId,
            projectName: row.projectName ?? 'Unknown',
            incoming: Number(row.incoming ?? 0),
            outgoing: Number(row.outgoing ?? 0)
        }));
    }

    async resources(tenant: Tenant, rawMinutes: string | undefined): Promise<ResourceUsageStat[]>{
        const rows: UsageRow[] = await Metric.query(`
            SELECT m."projectId" AS "projectId", p.name AS "projectName",
                   AVG(m."cpuPercent") AS "avgCpu",
                   AVG(m."memPercent") AS "avgMem",
                   MAX(m."memUsage") AS "maxMem"
            FROM ${this.#qualify('metric')} m
            LEFT JOIN ${this.#qualify('project')} p ON p.id = m."projectId"
            WHERE m."organizationId" = ANY($1) AND m.ts >= $2 AND m."projectId" IS NOT NULL
            GROUP BY m."projectId", p.name
            ORDER BY "avgCpu" DESC
        `, this.#params(tenant, rawMinutes));

        return rows.map((row) => ({
            projectId: row.projectId,
            projectName: row.projectName ?? 'Unknown',
            avgCpu: Number(row.avgCpu ?? 0),
            avgMem: Number(row.avgMem ?? 0),
            maxMem: Number(row.maxMem ?? 0)
        }));
    }

    #params(tenant: Tenant, rawMinutes: string | undefined): [number[], Date]{
        const organizationIds = tenant.organizationId !== null
            ? [tenant.organizationId]
            : tenant.organizationIds;
        const minutes = Math.min(Number(rawMinutes) || DEFAULT_MINUTES, MAX_MINUTES);
        return [organizationIds, new Date(Date.now() - minutes * 60 * 1000)];
    }

    #qualify(table: string): string{
        return config.databaseSchema === undefined ? table : `"${config.databaseSchema}".${table}`;
    }
}
