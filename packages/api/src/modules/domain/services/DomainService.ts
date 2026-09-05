import { eventBus } from '@/shared/events/EventBus';
import { saveOrConflict } from '@/shared/models/isUniqueViolation';
import { assertOrg } from '@/shared/tenancy';
import Repository from '@/modules/repository/models/Repository';
import Domain from '../models/Domain';
import { DomainError } from '../contracts/domain/errors';
import { DomainKind, DomainStatus, DomainTarget } from '@quantum/contracts/modules/domain/domain';
import type { Tenant } from '@/modules/organization/contracts/types/fastify';
import type { CreateDomainInput, CreateUpstreamDomainInput, UpdateDomainInput } from '@quantum/contracts/modules/domain/http';

/** Labels, digits and hyphens in dot-separated parts, optionally with a wildcard head. */
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

    /**
     * A domain that proxies somewhere this platform did not deploy. It belongs to the
     * organization rather than to a repository, so there is no project or container to
     * resolve — only an upstream the proxy will have to reach.
     */
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
        // A change to the host, the certificate or the upstream all move the published
        // route, so the file is republished rather than left describing the old one.
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

    /**
     * Validated, not escaped. The host is interpolated into the proxy's rule expression,
     * which delimits values with backticks — so a host carrying one could close the
     * matcher and append another, taking over routing for a name it does not own.
     * Constraining the shape to what a hostname may actually contain removes the class of
     * problem rather than escaping one instance of it.
     */
    #normalizeHost(raw: string): string{
        const host = raw.trim().toLowerCase();
        if(!HOSTNAME.test(host)) throw DomainError.InvalidHost();
        return host;
    }

    /**
     * Kept as the caller wrote it apart from trimming: the host part of an upstream is
     * frequently a container name or a LAN address, and lowercasing a path or normalising
     * a port would change where the traffic actually goes.
     */
    #normalizeUpstream(raw: string): string{
        const trimmed = raw.trim();
        if(!/^https?:\/\//i.test(trimmed)) throw DomainError.InvalidHost('Upstream');
        return trimmed.replace(/\/+$/, '');
    }
}
