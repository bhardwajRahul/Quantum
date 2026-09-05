import type { DomainKind, DomainStatus, DomainTarget } from '@quantum/contracts/modules/domain/domain';

export interface DomainFields{
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
    createdAt: Date;
    updatedAt: Date;
}
