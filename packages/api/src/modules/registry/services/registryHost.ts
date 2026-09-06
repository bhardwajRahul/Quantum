const DOCKER_HUB = 'docker.io';

const DOCKER_HUB_ALIASES = new Set(['docker.io', 'index.docker.io', 'registry-1.docker.io', 'registry.hub.docker.com', 'hub.docker.com']);

const HOST = /^[a-z0-9]([a-z0-9-]*[a-z0-9])?(\.[a-z0-9]([a-z0-9-]*[a-z0-9])?)*(:\d{1,5})?$/;

const looksLikeRegistry = (segment: string): boolean =>
    segment === 'localhost' || segment.includes('.') || segment.includes(':');

export const registryOf = (ref: string): string => {
    const [first, ...rest] = ref.split('/');
    if(rest.length === 0 || !looksLikeRegistry(first)) return DOCKER_HUB;
    return DOCKER_HUB_ALIASES.has(first.toLowerCase()) ? DOCKER_HUB : first.toLowerCase();
};

export const normalizeRegistry = (input: string): string | null => {
    const host = input.trim().toLowerCase().replace(/^[a-z]+:\/\//, '').replace(/\/.*$/, '');
    if(host === '' || !HOST.test(host)) return null;
    return DOCKER_HUB_ALIASES.has(host) ? DOCKER_HUB : host;
};

export const serverAddressOf = (registry: string): string =>
    registry === DOCKER_HUB ? 'https://index.docker.io/v1/' : registry;
