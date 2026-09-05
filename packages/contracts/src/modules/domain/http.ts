import type { DomainStatus } from './domain';

export interface CreateDomainInput{
    /**
     * @minLength 3
     */
    host: string;
    tls?: boolean;
    isPrimary?: boolean;
}

/**
 * A domain that proxies to something this platform did not deploy. The upstream is taken
 * as written — an address the proxy has to be able to reach, which is not the same as one
 * the reader's browser can reach.
 */
export interface CreateUpstreamDomainInput{
    /**
     * @minLength 3
     */
    host: string;
    /**
     * @format url
     */
    upstreamUrl: string;
    tls?: boolean;
}

export interface UpdateDomainInput{
    isPrimary?: boolean;
    tls?: boolean;
    status?: DomainStatus;
    /**
     * @format url
     */
    upstreamUrl?: string;
}
