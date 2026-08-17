import { call } from '@/shared/api/call';
import { domainRoutes } from '@quantum/contracts/modules/domain/routes';
import type { CreateDomainInput, UpdateDomainInput } from '@quantum/contracts/modules/domain/http';

export const domainApi = {
    listByRepository: (repositoryId: number) => call(domainRoutes.listByRepository, { path: { repositoryId } }),

    create: (repositoryId: number, body: CreateDomainInput) =>
        call(domainRoutes.create, { path: { repositoryId }, body }),

    get: (id: number) => call(domainRoutes.get, { path: { id } }),

    update: (id: number, body: UpdateDomainInput) => call(domainRoutes.update, { path: { id }, body }),

    remove: (id: number) => call(domainRoutes.remove, { path: { id } })
};
