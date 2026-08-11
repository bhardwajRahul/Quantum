import type { DomainKind, DomainStatus } from '@quantum/contracts/modules/domain/domain';

export interface DomainFields{
    host: string;
    repositoryId: number;
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
