import logger from '@utilities/logger';
import mongoose from 'mongoose';
import { Network } from 'dockerode';
import { getDockerHost } from '@services/docker/host';
import DockerNetworkModel from '@models/docker/network';
import { IDockerNetwork } from '@typings/models/docker/network';

const docker = getDockerHost().client();

export const getSystemNetworkName = (userId: string, networkId: string): string => {
    return `quantum-network-${process.env.NODE_ENV}-${userId}-${networkId}`;
}

export const EDGE_NETWORK_NAME = `quantum-edge-${process.env.NODE_ENV || 'development'}`;

export const ensureEdgeNetwork = async (): Promise<string> => {
    try{
        const existing = await docker.listNetworks({ filters: { name: [EDGE_NETWORK_NAME] } });
        if(existing.length === 0){
            await docker.createNetwork({ Name: EDGE_NETWORK_NAME, Driver: 'bridge', Attachable: true });
            logger.info(`@services/docker/network.ts (ensureEdgeNetwork): created ${EDGE_NETWORK_NAME}`);
        }
    }catch(error){
        logger.error('@services/docker/network.ts (ensureEdgeNetwork): ' + error);
    }
    return EDGE_NETWORK_NAME;
};

export const randomIPv4Subnet = (): string => {
    const getRandomInt = (min: number, max: number) => Math.floor(Math.random() * (max - min + 1)) + min;

    const octet2 = getRandomInt(0, 255);
    const octet3 = getRandomInt(0, 255);
    return `10.${octet2}.${octet3}.0/24`;
}

const parseCidr = (cidr: string): [number, number] | null => {
    const m = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})\/(\d{1,2})$/.exec((cidr || '').trim());
    if(!m) return null;
    const octets = [Number(m[1]), Number(m[2]), Number(m[3]), Number(m[4])];
    const prefix = Number(m[5]);
    if(octets.some((o) => o > 255) || prefix > 32) return null;

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
    const overlapsAny = (candidate: string) => existing.some((e) => cidrsOverlap(candidate, e));
    for(let attempt = 0; attempt < 20; attempt++){
        const candidate = rng();
        if(!overlapsAny(candidate)) return candidate;
    }
    for(let b = 0; b <= 255; b++){
        for(let c = 0; c <= 255; c++){
            const candidate = `10.${b}.${c}.0/24`;
            if(!overlapsAny(candidate)) return candidate;
        }
    }
    throw new Error('Docker::Network::SubnetExhausted::10.0.0.0/8');
};

const allocateFreeSubnet = async (): Promise<string> => {
    const networks = await docker.listNetworks();
    const existing = networks.flatMap((net) =>
        (net?.IPAM?.Config || [])
            .map((cfg) => (cfg as { Subnet?: string }).Subnet)
            .filter((s): s is string => Boolean(s))
    );
    return pickFreeSubnet(existing);
};

const createNetwork = async (networkId: string, driver: string, subnet: string): Promise<void> => {
    try{
        await docker.createNetwork({
            Name: networkId,
            Driver: driver,
            CheckDuplicate: true,
            Attachable: true,
            IPAM: {
                Driver: 'default',
                Config: [{ Subnet: subnet }]
            }
        });
    }catch(error){

        logger.error('@services/docker/network.ts (createNetwork): Error creating docker network ' + networkId + ': ' + error);
        throw error;
    }
}

const removeNetwork = async (networkName: string): Promise<void> => {
    try{
        const networks = await docker.listNetworks({
            filters: {
                name: [networkName]
            }
        });
        if(networks.length > 0){
            const network = new Network(docker.modem, networkName);
            await network.remove();
        }
    }catch(error){
        logger.error('@services/docker/network.ts (removeNetwork): Error when trying to delete docker network ' + error);
    }
}

export const materializeNetwork = async (doc: IDockerNetwork): Promise<void> => {

    if(!doc.subnet){
        doc.subnet = await allocateFreeSubnet();
        await DockerNetworkModel.updateOne({ _id: doc._id }, { subnet: doc.subnet });
    }
    await createNetwork(doc.dockerNetworkName, doc.driver, doc.subnet);
    await mongoose.model('User').updateOne({ _id: doc.user }, { $push: { networks: doc._id } });
};

export const createAndMaterializeNetwork = async (attrs: Record<string, any>) => {
    const network = await DockerNetworkModel.create(attrs);
    await materializeNetwork(network as unknown as IDockerNetwork);
    return network;
};

export const teardownNetwork = async (doc: IDockerNetwork): Promise<void> => {
    if(!doc?.dockerNetworkName) return;
    await removeNetwork(doc.dockerNetworkName);
};