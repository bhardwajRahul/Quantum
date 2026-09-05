/**
 * `repositoryId` is null for a domain that proxies to an upstream: there is no container
 * whose labels would need resyncing, only the generated router file.
 */
export interface DomainCreatedPayload{
    domainId: number;
    repositoryId: number | null;
}

export interface DomainDeletedPayload{
    domainId: number;
    repositoryId: number | null;
}
