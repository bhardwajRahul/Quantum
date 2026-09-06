import { eventBus } from '@/shared/events/EventBus';
import { saveOrConflict } from '@/shared/models/isUniqueViolation';
import { assertOrg } from '@/shared/tenancy';
import Repository from '@/modules/repository/models/Repository';
import Domain from '../models/Domain';
import { DomainError } from '../contracts/domain/errors';
import { DomainKind, DomainStatus, DomainTarget } from '@quantum/contracts/modules/domain/domain';
import type { Tenant } from '@/modules/organization/contracts/types/fastify';
import type { CreateDomainInput, CreateUpstreamDomainInput, UpdateDomainInput } from '@quantum/contracts/modules/domain/http';

const HOSTNAME = /^(\*\.)?[a-z0-9]([a-z0-9-]*[a-z0-9])?(\.[a-z0-9]([a-z0-9-]*[a-z0-9])?)*$/;

interface RepositoryScope{
    organizationId: number;
    projectId: number;
    userId: number;
}

export default class DomainService{
    async listForRepository(tenant: Tenant, repositoryId: number): Promise<Domain[]>{
        await this.#resolveRepository(tenant, repositoryId);
        return Domain.find({ where: { repositoryId }, order: { id: 'ASC' } });
    }

    listUpstreams(tenant: Tenant): Promise<Domain[]>{
        if(tenant.organizationId === null) throw DomainError.Forbidden();
        return Domain.find({
            where: { organizationId: tenant.organizationId, target: DomainTarget.Upstream },
            order: { id: 'ASC' }
        });
    }

    async createUpstream(tenant: Tenant, input: CreateUpstreamDomainInput): Promise<Domain>{
        if(tenant.organizationId === null) throw DomainError.Forbidden();

        const domain = await saveOrConflict(Domain.create({
            host: this.#normalizeHost(input.host),
            target: DomainTarget.Upstream,
            repositoryId: null,
            upstreamUrl: this.#normalizeUpstream(input.upstreamUrl),
            organizationId: tenant.organizationId,
            projectId: 0,
            userId: null,
            kind: DomainKind.Custom,
            isPrimary: false,
            tls: input.tls ?? true,
            status: DomainStatus.Pending
        }).save(), DomainError.AlreadyExists);

        eventBus.emit('domain.created', { domainId: domain.id, repositoryId: null });
        return domain;
    }

    async create(tenant: Tenant, repositoryId: number, input: CreateDomainInput): Promise<Domain>{
        const scope = await this.#resolveRepository(tenant, repositoryId);
        const existingCount = await Domain.countBy({ repositoryId });

        const domain = await saveOrConflict(Domain.create({
            host: this.#normalizeHost(input.host),
            target: DomainTarget.Repository,
            repositoryId,
            upstreamUrl: null,
            organizationId: scope.organizationId,
            projectId: scope.projectId,
            userId: scope.userId,
            kind: DomainKind.Custom,
            isPrimary: input.isPrimary ?? existingCount === 0,
            tls: input.tls ?? true,
            status: DomainStatus.Pending
        }).save(), DomainError.AlreadyExists);

        eventBus.emit('domain.created', { domainId: domain.id, repositoryId });
        return domain;
    }

    async getOwned(tenant: Tenant, domainId: number): Promise<Domain>{
        const domain = await Domain.findOneBy({ id: domainId });
        if(!domain) throw DomainError.NotFound();
        assertOrg(tenant, domain.organizationId, DomainError.Forbidden);
        return domain;
    }

    async update(tenant: Tenant, domainId: number, input: UpdateDomainInput): Promise<Domain>{
        const domain = await this.getOwned(tenant, domainId);
        if(input.isPrimary !== undefined) domain.isPrimary = input.isPrimary;
        if(input.tls !== undefined) domain.tls = input.tls;
        if(input.status !== undefined) domain.status = input.status;
        if(input.upstreamUrl !== undefined){
            if(domain.target !== DomainTarget.Upstream) throw DomainError.Forbidden('Upstream');
            domain.upstreamUrl = this.#normalizeUpstream(input.upstreamUrl);
        }

        const saved = await domain.save();
        eventBus.emit('domain.created', { domainId: saved.id, repositoryId: saved.repositoryId });
        return saved;
    }

    async remove(tenant: Tenant, domainId: number): Promise<void>{
        const domain = await this.getOwned(tenant, domainId);
        const payload = { domainId: domain.id, repositoryId: domain.repositoryId };
        await domain.remove();

        eventBus.emit('domain.deleted', payload);
    }

    async #resolveRepository(tenant: Tenant, repositoryId: number): Promise<RepositoryScope>{
        const repository = await Repository.findOneBy({ id: repositoryId });
        if(!repository || repository.organizationId === null) throw DomainError.NotFound('Repository');
        assertOrg(tenant, repository.organizationId, () => DomainError.Forbidden('Repository'));
        return {
            organizationId: repository.organizationId,
            projectId: repository.projectId,
            userId: repository.userId
        };
    }

    #normalizeHost(raw: string): string{
        const host = raw.trim().toLowerCase();
        if(!HOSTNAME.test(host)) throw DomainError.InvalidHost();
        return host;
    }

    #normalizeUpstream(raw: string): string{
        const trimmed = raw.trim();
        if(!/^https?:\/\//i.test(trimmed)) throw DomainError.InvalidHost('Upstream');
        return trimmed.replace(/\/+$/, '');
    }
}
