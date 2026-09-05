import { In, MoreThanOrEqual } from 'typeorm';
import AnalyticsEvent from '../models/AnalyticsEvent';
import AnalyticsRollup from '../models/AnalyticsRollup';
import DomainService from '@/modules/domain/services/DomainService';
import type { FindOptionsWhere } from 'typeorm';
import type { Tenant } from '@/modules/organization/contracts/types/fastify';
import type { AnalyticsSummary, AnalyticsTop, DomainStat, TopEntry } from '@quantum/contracts/modules/analytics/domain';

const DEFAULT_TOP = 10;
const MAX_MINUTES = 90 * 24 * 60;
const DEFAULT_MINUTES = 1440;

export default class AnalyticsService{
    #domains = new DomainService();

    async summary(tenant: Tenant, rawMinutes: string | number | undefined, rawDomainId: string | number | undefined): Promise<AnalyticsSummary>{
        const domainId = await this.#resolveDomainId(tenant, rawDomainId);
        const rollups = await AnalyticsRollup.find({ where: this.#rollupScope(tenant, this.#since(rawMinutes), domainId) });

        const pageviews = rollups.reduce((sum, rollup) => sum + rollup.pageviews, 0);
        const visitors = rollups.reduce((sum, rollup) => sum + rollup.visitors, 0);
        const bounces = rollups.reduce((sum, rollup) => sum + rollup.bounces, 0);
        const bounceRate = visitors > 0 ? Math.round((bounces / visitors) * 1000) / 10 : 0;

        return { pageviews, visitors, bounces, bounceRate };
    }

    async top(tenant: Tenant, rawMinutes: string | number | undefined, rawDomainId: string | number | undefined): Promise<AnalyticsTop>{
        const domainId = await this.#resolveDomainId(tenant, rawDomainId);
        const since = this.#since(rawMinutes);
        const rollups = await AnalyticsRollup.find({ where: this.#rollupScope(tenant, since, domainId) });
        const events = await AnalyticsEvent.find({
            where: this.#eventScope(tenant, since, domainId),
            select: { utmSource: true, utmMedium: true, utmCampaign: true }
        });

        return {
            hostnames: this.#hostnameTotals(rollups),
            paths: this.#mergeMaps(rollups, (rollup) => rollup.topPaths),
            referrers: this.#mergeMaps(rollups, (rollup) => rollup.topReferrers),
            countries: this.#mergeMaps(rollups, (rollup) => rollup.countries),
            devices: this.#mergeMaps(rollups, (rollup) => rollup.devices),
            browsers: this.#mergeMaps(rollups, (rollup) => rollup.browsers),
            os: this.#mergeMaps(rollups, (rollup) => rollup.os),
            utm: {
                source: this.#utmTotals(events, (event) => event.utmSource),
                medium: this.#utmTotals(events, (event) => event.utmMedium),
                campaign: this.#utmTotals(events, (event) => event.utmCampaign)
            }
        };
    }

    async domains(tenant: Tenant, rawMinutes: string | number | undefined, rawDomainId: string | number | undefined): Promise<DomainStat[]>{
        const domainId = await this.#resolveDomainId(tenant, rawDomainId);
        const rollups = await AnalyticsRollup.find({ where: this.#rollupScope(tenant, this.#since(rawMinutes), domainId) });

        const totals = new Map<string, number>();
        for(const rollup of rollups){
            if(rollup.host === null) continue;
            totals.set(rollup.host, (totals.get(rollup.host) ?? 0) + rollup.pageviews);
        }

        return [...totals.entries()]
            .map(([host, pageviews]) => ({ host, pageviews }))
            .sort((a, b) => b.pageviews - a.pageviews || a.host.localeCompare(b.host));
    }

    async #resolveDomainId(tenant: Tenant, rawDomainId: string | number | undefined): Promise<number | undefined>{
        if(rawDomainId === undefined) return undefined;
        const domain = await this.#domains.getOwned(tenant, Number(rawDomainId));
        return domain.id;
    }

    #since(rawMinutes: string | number | undefined): Date{
        const minutes = Math.min(Number(rawMinutes) || DEFAULT_MINUTES, MAX_MINUTES);
        return new Date(Date.now() - minutes * 60 * 1000);
    }

    #rollupScope(tenant: Tenant, since: Date, domainId: number | undefined): FindOptionsWhere<AnalyticsRollup>{
        const scope = tenant.isPlatformAdmin
            ? { bucket: MoreThanOrEqual(since) }
            : { organizationId: In(tenant.organizationIds), bucket: MoreThanOrEqual(since) };
        return domainId === undefined ? scope : { ...scope, domainId };
    }

    #eventScope(tenant: Tenant, since: Date, domainId: number | undefined): FindOptionsWhere<AnalyticsEvent>{
        const scope = tenant.isPlatformAdmin
            ? { ts: MoreThanOrEqual(since) }
            : { organizationId: In(tenant.organizationIds), ts: MoreThanOrEqual(since) };
        return domainId === undefined ? scope : { ...scope, domainId };
    }

    #hostnameTotals(rollups: AnalyticsRollup[]): TopEntry[]{
        const totals = new Map<string, number>();
        for(const rollup of rollups){
            if(rollup.host === null) continue;
            totals.set(rollup.host, (totals.get(rollup.host) ?? 0) + rollup.pageviews);
        }
        return this.#entries(totals);
    }

    #mergeMaps(rollups: AnalyticsRollup[], pick: (rollup: AnalyticsRollup) => Record<string, number>): TopEntry[]{
        const totals = new Map<string, number>();
        for(const rollup of rollups){
            for(const [key, value] of Object.entries(pick(rollup))){
                totals.set(key, (totals.get(key) ?? 0) + value);
            }
        }
        return this.#entries(totals);
    }

    #utmTotals(events: AnalyticsEvent[], pick: (event: AnalyticsEvent) => string | null): TopEntry[]{
        const totals = new Map<string, number>();
        for(const event of events){
            const value = pick(event);
            if(value === null || value === '') continue;
            totals.set(value, (totals.get(value) ?? 0) + 1);
        }
        return this.#entries(totals);
    }

    #entries(totals: Map<string, number>): TopEntry[]{
        return [...totals.entries()]
            .map(([key, value]) => ({ key, value }))
            .sort((a, b) => b.value - a.value || a.key.localeCompare(b.key))
            .slice(0, DEFAULT_TOP);
    }
}
