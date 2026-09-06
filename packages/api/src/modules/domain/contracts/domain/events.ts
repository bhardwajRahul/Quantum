export interface DomainCreatedPayload{
    domainId: number;
    repositoryId: number | null;
}

export interface DomainDeletedPayload{
    domainId: number;
    repositoryId: number | null;
}
