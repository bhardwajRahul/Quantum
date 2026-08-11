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

export interface Domain extends BaseEntity{
    host: string;
    repositoryId: number;
    organizationId: number;
    projectId: number;
    userId: number | null;
    kind: DomainKind;
    isPrimary: boolean;
    tls: boolean;
    status: DomainStatus;
}
