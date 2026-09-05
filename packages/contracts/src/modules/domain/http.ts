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
     * Deliberately not `@format url`, which demands a public-looking hostname and so
     * rejects `http://jellyfin:8096` or a bare LAN address — the two upstreams this
     * exists to serve. The scheme is required, the host may be a single label or an IP,
     * and whitespace and quoting characters are refused so the value cannot escape the
     * generated configuration.
     *
     * @pattern ^https?:\/\/[A-Za-z0-9._~-]+(:[0-9]{1,5})?(\/[A-Za-z0-9._~\-\/%]*)?$
     */
    upstreamUrl: string;
    tls?: boolean;
}

export interface UpdateDomainInput{
    isPrimary?: boolean;
    tls?: boolean;
    status?: DomainStatus;
    /**
     * @pattern ^https?:\/\/[A-Za-z0-9._~-]+(:[0-9]{1,5})?(\/[A-Za-z0-9._~\-\/%]*)?$
     */
    upstreamUrl?: string;
}
