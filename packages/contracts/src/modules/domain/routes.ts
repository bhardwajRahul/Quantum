import { del, get, patch, post } from '../../shared/routing';
import type { CreateDomainInput, UpdateDomainInput } from './http';
import type { Domain } from './domain';

export const domainRoutes = {
    listByRepository: get<Domain[]>('/domain/repository/:repositoryId'),
    create: post<CreateDomainInput, Domain>('/domain/repository/:repositoryId'),
    update: patch<UpdateDomainInput, Domain>('/domain/:id'),
    remove: del('/domain/:id')
};
