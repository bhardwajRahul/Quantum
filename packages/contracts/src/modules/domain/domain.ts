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
    /** A repository this platform deploys: routed by labels on its own container. */
    Repository = 'repository',
    /** Anything else reachable from the proxy: routed by generated file configuration. */
    Upstream = 'upstream'
}

export interface Domain extends BaseEntity{
    host: string;
    /**
     * Exactly one of `repositoryId` / `upstreamUrl` is set, and `target` says which.
     * Keeping the discriminator explicit is what stops a domain that points at both, or
     * at neither, from being representable at all.
     */
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
