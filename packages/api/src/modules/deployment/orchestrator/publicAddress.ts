import { lookup } from 'node:dns/promises';
import { isIP } from 'node:net';
import { config } from '@/shared/config';
import { publicHost } from './publicHost';

let resolved: string | null = null;

const resolve = async (host: string): Promise<string | null> => {
    if(isIP(host) || host === 'localhost') return host;
    try{
        return (await lookup(host, { family: 4 })).address;
    }catch{
        return null;
    }
};

export const publicAddress = async (): Promise<string> => {
    const explicit = config.publicHost?.trim();
    if(explicit) return explicit;
    resolved ??= await resolve(publicHost());
    return resolved ?? publicHost();
};
