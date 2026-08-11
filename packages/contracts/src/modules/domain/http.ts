import type { DomainStatus } from './domain';

export interface CreateDomainInput{
    /**
     * @minLength 3
     */
    host: string;
    tls?: boolean;
    isPrimary?: boolean;
}

export interface UpdateDomainInput{
    isPrimary?: boolean;
    tls?: boolean;
    status?: DomainStatus;
}
