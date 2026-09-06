import { Not } from 'typeorm';
import Domain from '@/modules/domain/models/Domain';
import Repository from '@/modules/repository/models/Repository';
import { getDockerHost } from './DockerHost';
import { EDGE_NETWORK_NAME } from './NetworkOps';
import { getDefaultPort } from './RuntimeRegistry';
import { DomainKind, DomainStatus } from '@quantum/contracts/modules/domain/domain';
import { config } from '@/shared/config';
import { logger } from '@/shared/utils/Logger';

interface RouterSource{
    id: number;
    alias: string;
}

interface PortSource{
    port: number | null;
    runtime: string | null;
}

interface DomainLabelSource{
    host: string;
    tls: boolean;
}

export const sanitizeRouterName = (source: RouterSource): string => {
    const raw = source.alias || String(source.id);
    const name = String(raw).toLowerCase().replace(/[^a-z0-9_.-]/g, '-').replace(/^-+|-+$/g, '');
    return name || 'app';
};

export const resolveInternalPort = (source: PortSource): number =>
    source.port ?? getDefaultPort(source.runtime);

export const buildTraefikLabels = (
    source: RouterSource & PortSource,
    domains: DomainLabelSource[],
    internalPort?: number
): Record<string, string> => {
    const eligible = (domains || []).filter((domain) => !!domain.host && domain.host.trim().length > 0);
    if(eligible.length === 0) return {};

    const router = sanitizeRouterName(source);
    const port = internalPort && internalPort > 0 ? internalPort : resolveInternalPort(source);
    const tlsHosts = eligible.filter((domain) => domain.tls !== false).map((domain) => domain.host);
    const plainHosts = eligible.filter((domain) => domain.tls === false).map((domain) => domain.host);

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

        labels[`traefik.http.routers.${router}-redirect.rule`] = rule;
        labels[`traefik.http.routers.${router}-redirect.entrypoints`] = 'web';
        labels[`traefik.http.routers.${router}-redirect.middlewares`] = 'to-https@file';
    }
    if(plainHosts.length > 0){
        labels[`traefik.http.routers.${router}-plain.rule`] = plainHosts.map((host) => `Host(\`${host}\`)`).join('||');
        labels[`traefik.http.routers.${router}-plain.entrypoints`] = 'web';
    }
    return labels;
};

export default class IngressService{
    async getIngressLabels(repository: Repository): Promise<Record<string, string>>{
        if(!config.ingress.enabled) return {};
        const domains = await Domain.find({ where: { repositoryId: repository.id } });
        if(domains.length === 0) return {};
        return buildTraefikLabels(repository, domains, resolveInternalPort(repository));
    }

    async connectContainerToEdge(containerName: string): Promise<void>{
        if(!containerName) return;
        try{
            const network = getDockerHost().getNetwork(EDGE_NETWORK_NAME);
            await network.connect({ Container: containerName });
            logger.info(`attached ${containerName} to ${EDGE_NETWORK_NAME}`, { scope: 'orchestrator.ingress' });
        }catch(error){
            const status = (error as { statusCode?: number }).statusCode;
            if(status === 403) return;
            logger.warn(`connectContainerToEdge ${containerName} failed: ${(error as Error).message}`, { scope: 'orchestrator.ingress' });
        }
    }

    async ensureSubdomain(repository: Repository): Promise<void>{
        const baseDomain = config.ingress.baseDomain;
        if(!baseDomain || repository.organizationId === null) return;
        const alias = repository.alias || String(repository.id);
        if(!alias) return;
        const host = `${alias}.${baseDomain}`.toLowerCase();
        if(await Domain.findOneBy({ host })) return;

        await this.#replaceSubdomain(repository, repository.organizationId, host);
        logger.info(`provisioned subdomain ${host} for repository ${repository.id}`, { scope: 'orchestrator.ingress' });
    }

    async #replaceSubdomain(repository: Repository, organizationId: number, host: string): Promise<void>{
        await Domain.delete({ repositoryId: repository.id, kind: DomainKind.Subdomain, host: Not(host) });
        const isFirst = (await Domain.countBy({ repositoryId: repository.id })) === 0;
        await Domain.create({
            repositoryId: repository.id,
            organizationId,
            projectId: repository.projectId,
            userId: repository.userId,
            host,
            kind: DomainKind.Subdomain,
            isPrimary: isFirst,
            tls: true,
            status: DomainStatus.Pending
        }).save();
    }
}
