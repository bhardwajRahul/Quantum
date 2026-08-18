import { EDGE_NETWORK_NAME } from '@services/docker/network';
import { getDefaultPort } from '@services/runtime/registry';
import { IRepository } from '@typings/models/repository';
import { IDomain } from '@typings/models/domain';

export const sanitizeRouterName = (repository: Pick<IRepository, 'alias' | '_id'>): string => {
    const raw = repository.alias || (repository._id ? repository._id.toString() : '');
    const name = String(raw).toLowerCase().replace(/[^a-z0-9_.-]/g, '-').replace(/^-+|-+$/g, '');
    return name || 'app';
};

export const resolveInternalPort = (repository: Pick<IRepository, 'port' | 'runtime'>): number =>
    repository.port || getDefaultPort(repository.runtime);

export const buildTraefikLabels = (
    repository: Pick<IRepository, 'alias' | '_id' | 'port' | 'runtime'>,
    domains: Pick<IDomain, 'host' | 'tls'>[],
    internalPort?: number
): Record<string, string> => {
    const eligible = (domains || []).filter((d) => !!d.host && String(d.host).trim().length > 0);
    if(eligible.length === 0) return {};

    const router = sanitizeRouterName(repository);
    const port = internalPort && internalPort > 0 ? internalPort : resolveInternalPort(repository);

    const tlsHosts = eligible.filter((d) => d.tls !== false).map((d) => d.host as string);
    const plainHosts = eligible.filter((d) => d.tls === false).map((d) => d.host as string);

    const labels: Record<string, string> = {
        'traefik.enable': 'true',
        [`traefik.http.services.${router}.loadbalancer.server.port`]: String(port),
        'traefik.docker.network': EDGE_NETWORK_NAME
    };
    if(tlsHosts.length > 0){
        const rule = tlsHosts.map((host) => `Host(\`${host}\`)`).join('||');
        labels[`traefik.http.routers.${router}.rule`] = rule;
        labels[`traefik.http.routers.${router}.entrypoints`] = 'websecure';
        labels[`traefik.http.routers.${router}.tls`] = 'true';
        labels[`traefik.http.routers.${router}.tls.certresolver`] = 'le';
    }
    if(plainHosts.length > 0){
        const rule = plainHosts.map((host) => `Host(\`${host}\`)`).join('||');
        labels[`traefik.http.routers.${router}-plain.rule`] = rule;
        labels[`traefik.http.routers.${router}-plain.entrypoints`] = 'web';
    }
    return labels;
};

export default buildTraefikLabels;
