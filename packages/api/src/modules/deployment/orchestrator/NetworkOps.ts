import { Network } from 'dockerode';
import { getDockerHost } from './DockerHost';
import DockerNetwork from '@/modules/docker/models/DockerNetwork';
import { logger } from '@/shared/utils/Logger';
import { config } from '@/shared/config';

export const EDGE_NETWORK_NAME = `quantum-edge-${config.nodeEnv}`;

export const getSystemNetworkName = (userId: number, networkId: number): string =>
    `quantum-network-${config.nodeEnv}-${userId}-${networkId}`;

export const ensureEdgeNetwork = async (): Promise<string> => {
    try{
        const docker = getDockerHost().client();
        const existing = await docker.listNetworks({ filters: { name: [EDGE_NETWORK_NAME] } });
        if(existing.length === 0){
            await docker.createNetwork({ Name: EDGE_NETWORK_NAME, Driver: 'bridge', Attachable: true });
            logger.info(`created edge network ${EDGE_NETWORK_NAME}`, { scope: 'orchestrator.network' });
        }
    }catch(error){
        logger.error('ensureEdgeNetwork failed', error, { scope: 'orchestrator.network' });
    }
    return EDGE_NETWORK_NAME;
};

const randomIPv4Subnet = (): string => {
    const octet = () => Math.floor(Math.random() * 256);
    return `10.${octet()}.${octet()}.0/24`;
};

const parseCidr = (cidr: string): [number, number] | null => {
    const match = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})\/(\d{1,2})$/.exec((cidr || '').trim());
    if(!match) return null;
    const octets = [Number(match[1]), Number(match[2]), Number(match[3]), Number(match[4])];
    const prefix = Number(match[5]);
    if(octets.some((value) => value > 255) || prefix > 32) return null;
    const addr = ((octets[0] << 24) | (octets[1] << 16) | (octets[2] << 8) | octets[3]) >>> 0;
    const mask = prefix === 0 ? 0 : (0xffffffff << (32 - prefix)) >>> 0;
    return [(addr & mask) >>> 0, prefix];
};

const cidrsOverlap = (a: string, b: string): boolean => {
    const pa = parseCidr(a);
    const pb = parseCidr(b);
    if(!pa || !pb) return false;
    const prefix = Math.min(pa[1], pb[1]);
    const mask = prefix === 0 ? 0 : (0xffffffff << (32 - prefix)) >>> 0;
    return ((pa[0] & mask) >>> 0) === ((pb[0] & mask) >>> 0);
};

export const pickFreeSubnet = (existing: string[], rng: () => string = randomIPv4Subnet): string => {
    const overlapsAny = (candidate: string) => existing.some((subnet) => cidrsOverlap(candidate, subnet));
    for(let attempt = 0; attempt < 20; attempt++){
        const candidate = rng();
        if(!overlapsAny(candidate)) return candidate;
    }
    throw new Error('Docker::Network::SubnetExhausted::10.0.0.0/8');
};

const allocateFreeSubnet = async (): Promise<string> => {
    const networks = await getDockerHost().client().listNetworks();
    const existing = networks.flatMap((net) =>
        (net?.IPAM?.Config || [])
            .map((cfg) => (cfg as { Subnet?: string }).Subnet)
            .filter((subnet): subnet is string => Boolean(subnet))
    );
    return pickFreeSubnet(existing);
};

export const materializeNetwork = async (network: DockerNetwork): Promise<void> => {
    if(!network.subnet){
        network.subnet = await allocateFreeSubnet();
        await network.save();
    }
    try{
        await getDockerHost().client().createNetwork({
            Name: network.dockerNetworkName,
            Driver: network.driver,
            Attachable: true,
            IPAM: { Driver: 'default', Config: [{ Subnet: network.subnet }] }
        });
    }catch(error){
        logger.error(`failed creating docker network ${network.dockerNetworkName}`, error, { scope: 'orchestrator.network' });
        throw error;
    }
};

export const teardownNetwork = async (network: DockerNetwork): Promise<void> => {
    if(!network.dockerNetworkName) return;
    try{
        const docker = getDockerHost().client();
        const found = await docker.listNetworks({ filters: { name: [network.dockerNetworkName] } });
        if(found.length > 0){
            await new Network(docker.modem, network.dockerNetworkName).remove();
        }
    }catch(error){
        logger.error(`failed removing docker network ${network.dockerNetworkName}`, error, { scope: 'orchestrator.network' });
    }
};
