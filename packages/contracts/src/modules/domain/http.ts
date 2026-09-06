import type { DomainStatus } from './domain';

export interface CreateDomainInput{
    host: string;
    tls?: boolean;
    isPrimary?: boolean;
}

export interface CreateUpstreamDomainInput{
    host: string;
    upstreamUrl: string;
    tls?: boolean;
}

export interface UpdateDomainInput{
    isPrimary?: boolean;
    tls?: boolean;
    status?: DomainStatus;
    upstreamUrl?: string;
}
