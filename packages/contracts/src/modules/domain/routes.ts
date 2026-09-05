import { del, get, patch, post } from '../../shared/routing';
import type { CreateDomainInput, CreateUpstreamDomainInput, UpdateDomainInput } from './http';
import type { Domain } from './domain';

export const domainRoutes = {
    listByRepository: get<Domain[]>('/domain/repository/:repositoryId'),
    listUpstreams: get<Domain[]>('/domain/upstream'),
    create: post<CreateDomainInput, Domain>('/domain/repository/:repositoryId'),
    createUpstream: post<CreateUpstreamDomainInput, Domain>('/domain/upstream'),
    update: patch<UpdateDomainInput, Domain>('/domain/:id'),
    remove: del('/domain/:id')
};
