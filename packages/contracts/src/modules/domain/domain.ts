import type { BaseEntity } from '../../shared/base';

export enum DomainKind{
    Custom = 'custom',
    Subdomain = 'subdomain'
}

export enum DomainStatus{
    Pending = 'pending',
    Active = 'active',
    Error = 'error'
}

export enum DomainTarget{
    Repository = 'repository',
    Upstream = 'upstream'
}

export interface Domain extends BaseEntity{
    host: string;
    target: DomainTarget;
    repositoryId: number | null;
    upstreamUrl: string | null;
    organizationId: number;
    projectId: number;
    userId: number | null;
    kind: DomainKind;
    isPrimary: boolean;
    tls: boolean;
    status: DomainStatus;
}
