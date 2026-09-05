import { eventBus } from '@/shared/events/EventBus';
import { saveOrConflict } from '@/shared/models/isUniqueViolation';
import { assertOrg } from '@/shared/tenancy';
import Repository from '@/modules/repository/models/Repository';
import Domain from '../models/Domain';
import { DomainError } from '../contracts/domain/errors';
import { DomainKind, DomainStatus } from '@quantum/contracts/modules/domain/domain';
import type { Tenant } from '@/modules/organization/contracts/types/fastify';
import type { CreateDomainInput, UpdateDomainInput } from '@quantum/contracts/modules/domain/http';

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

    async create(tenant: Tenant, repositoryId: number, input: CreateDomainInput): Promise<Domain>{
        const scope = await this.#resolveRepository(tenant, repositoryId);
        const existingCount = await Domain.countBy({ repositoryId });

        const domain = await saveOrConflict(Domain.create({
            host: this.#normalizeHost(input.host),
            repositoryId,
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
        return domain.save();
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
        return raw.trim().toLowerCase();
    }
}
