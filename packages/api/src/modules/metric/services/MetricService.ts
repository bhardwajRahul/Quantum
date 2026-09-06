import { In, MoreThanOrEqual } from 'typeorm';
import { assertOrg } from '@/shared/tenancy';
import Metric from '../models/Metric';
import DockerContainer from '@/modules/docker/models/DockerContainer';
import Repository from '@/modules/repository/models/Repository';
import Database from '@/modules/database/models/Database';
import TemplateInstall from '@/modules/template/models/TemplateInstall';
import Codespace from '@/modules/codespace/models/Codespace';
import { MetricError } from '../contracts/domain/errors';
import type { FindOptionsWhere } from 'typeorm';
import type { Tenant } from '@/modules/organization/contracts/types/fastify';
import type { MonitoredContainer, MonitoredContainerKind } from '@quantum/contracts/modules/metric/domain';

const MAX_WINDOW = 1000;
const DEFAULT_LIMIT = 200;
const DEFAULT_MINUTES = 60;

const KIND_ORDER: Record<MonitoredContainerKind, number> = { repository: 0, database: 1, stack: 2, workspace: 3 };

type Owner = Omit<MonitoredContainer, 'containerId'>;

const byKindThenName = (a: MonitoredContainer, b: MonitoredContainer): number =>
    KIND_ORDER[a.kind] - KIND_ORDER[b.kind]
    || a.app.localeCompare(b.app)
    || (a.service ?? '').localeCompare(b.service ?? '');

export default class MetricService{
    async containers(tenant: Tenant): Promise<MonitoredContainer[]>{
        const organizationIds = tenant.organizationId !== null ? [tenant.organizationId] : tenant.organizationIds;
        if(organizationIds.length === 0) return [];

        const where = { organizationId: In(organizationIds) };
        const [containers, repositories, databases, installs, codespaces] = await Promise.all([
            DockerContainer.find({ where }),
            Repository.find({ where }),
            Database.find({ where }),
            TemplateInstall.find({ where }),
            Codespace.find({ where })
        ]);

        const repositoriesById = new Map(repositories.map((repository) => [repository.id, repository]));
        const owners = new Map<number, Owner>();
        for(const database of databases){
            if(database.containerId !== null) owners.set(database.containerId, { kind: 'database', app: database.name, service: null });
        }
        for(const codespace of codespaces){
            if(codespace.containerId !== null) owners.set(codespace.containerId, { kind: 'workspace', app: codespace.name, service: null });
        }
        for(const install of installs){
            for(const service of install.services){
                if(service.containerId !== null) owners.set(service.containerId, { kind: 'stack', app: install.name, service: service.name });
            }
        }

        return containers
            .flatMap((container): MonitoredContainer[] => {
                const repository = container.repositoryId === null ? undefined : repositoriesById.get(container.repositoryId);
                const owner: Owner | undefined = repository === undefined
                    ? owners.get(container.id)
                    : { kind: 'repository', app: repository.name !== '' ? repository.name : repository.alias, service: null };
                return owner === undefined ? [] : [{ containerId: container.id, ...owner }];
            })
            .sort(byKindThenName);
    }

    async byContainer(tenant: Tenant, containerId: number, limit: string | number | undefined, minutes: string | number | undefined): Promise<Metric[]>{
        const container = await DockerContainer.findOneBy({ id: containerId });
        if(!container) throw MetricError.NotFound();
        assertOrg(tenant, container.organizationId, MetricError.Forbidden);
        return this.#window({ containerId }, limit, minutes);
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
}
