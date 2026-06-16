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

/**
 * The shared "edge" network. Both the ingress reverse proxy (Traefik) and managed
 * databases attach to it so the proxy can reach app containers and apps can reach
 * databases by container name, without exposing host ports. Idempotent.
 */
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
    // Stay inside 10.0.0.0/8 — the largest RFC1918 block (65k /24s), so random
    // picks almost never collide, and it never overlaps Docker's default 172.x/16
    // bridges. (172.16/12 is a trap: a random /24 there overlaps the /16 networks
    // Docker Compose/bridge already hold.) 192.168/16 is too small to spread into.
    const octet2 = getRandomInt(0, 255);
    const octet3 = getRandomInt(0, 255);
    return `10.${octet2}.${octet3}.0/24`;
}

/** Parse "a.b.c.d/p" into [networkInt, prefix], or null if malformed. */
const parseCidr = (cidr: string): [number, number] | null => {
    const m = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})\/(\d{1,2})$/.exec((cidr || '').trim());
    if(!m) return null;
    const octets = [Number(m[1]), Number(m[2]), Number(m[3]), Number(m[4])];
    const prefix = Number(m[5]);
    if(octets.some((o) => o > 255) || prefix > 32) return null;
    // >>> 0 keeps it an unsigned 32-bit int.
    const addr = ((octets[0] << 24) | (octets[1] << 16) | (octets[2] << 8) | octets[3]) >>> 0;
    const mask = prefix === 0 ? 0 : (0xffffffff << (32 - prefix)) >>> 0;
    return [(addr & mask) >>> 0, prefix];
};

/** True if the two CIDRs share any address (overlap). Robust to /8../32 either way. */
const cidrsOverlap = (a: string, b: string): boolean => {
    const pa = parseCidr(a);
    const pb = parseCidr(b);
    if(!pa || !pb) return false;
    const prefix = Math.min(pa[1], pb[1]); // compare on the shorter (broader) mask
    const mask = prefix === 0 ? 0 : (0xffffffff << (32 - prefix)) >>> 0;
    return ((pa[0] & mask) >>> 0) === ((pb[0] & mask) >>> 0);
};

/**
 * Pure subnet picker: choose a /24 inside 10.0.0.0/8 that overlaps none of
 * `existing`. Tries `rng()` candidates first (spreads load), then a deterministic
 * linear scan so a saturated space still resolves instead of spinning on random
 * collisions. Throws Docker::Network::SubnetExhausted if 10/8 is full.
 * Separated from Docker I/O so it is unit-testable. `rng` defaults to the random
 * picker; tests inject a deterministic one.
 */
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

/**
 * Allocate a /24 that does NOT overlap any subnet held by a real Docker network.
 * Fixes the "Pool overlaps with other one on this address space" 403: the old code
 * picked a /24 blindly (and sometimes inside 172.16/12, overlapping Docker's own
 * /16 bridges), so creation failed once enough networks existed.
 */
const allocateFreeSubnet = async (): Promise<string> => {
    const networks = await docker.listNetworks();
    const existing: string[] = [];
    for(const net of networks){
        for(const cfg of net?.IPAM?.Config || []){
            const subnet = (cfg as { Subnet?: string }).Subnet;
            if(subnet) existing.push(subnet);
        }
    }
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
        // Do NOT swallow: a rejected subnet (e.g. overlap/unroutable) used to fail
        // silently here, leaving the container declared on a network it never joined
        // → getIpAddress crashed and the deploy "succeeded" with no networking.
        // Surface it so materialize/deploy fails loudly and the queue can retry.
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

/**
 * Create the REAL Docker network for an already-persisted DockerNetwork doc and
 * maintain the User back-reference. Relocation of the side effects that used to
 * live in DockerNetwork.pre('save') — the model now only derives the pure
 * subnet/dockerNetworkName fields (ADR-0001). The doc must already carry
 * dockerNetworkName/driver/subnet (set by the pure hook on create).
 */
export const materializeNetwork = async (doc: IDockerNetwork): Promise<void> => {
    // Allocate a collision-free subnet HERE (needs to read the live Docker network
    // list, so it can't live in the model's pure pre-save hook). The hook leaves
    // subnet unset; we fill it, persist it, then create the real network.
    if(!doc.subnet){
        doc.subnet = await allocateFreeSubnet();
        await DockerNetworkModel.updateOne({ _id: doc._id }, { subnet: doc.subnet });
    }
    await createNetwork(doc.dockerNetworkName, doc.driver, doc.subnet);
    await mongoose.model('User').updateOne({ _id: doc.user }, { $push: { networks: doc._id } });
};

/**
 * Persist a DockerNetwork doc (pure save) then materialize its real Docker
 * network. Mirrors the old resolve-or-create call sites where `.create()` used
 * to trigger the daemon work implicitly.
 */
export const createAndMaterializeNetwork = async (attrs: Record<string, any>) => {
    const network = await DockerNetworkModel.create(attrs);
    await materializeNetwork(network as unknown as IDockerNetwork);
    return network;
};

/**
 * Remove the REAL Docker network for a deleted DockerNetwork doc. Relocation of
 * the daemon teardown that used to live in the network's delete hooks (ADR-0001);
 * the DB ref-cascade stays in the hook. No-op if the doc carries no network name.
 */
export const teardownNetwork = async (doc: IDockerNetwork): Promise<void> => {
    if(!doc?.dockerNetworkName) return;
    await removeNetwork(doc.dockerNetworkName);
};