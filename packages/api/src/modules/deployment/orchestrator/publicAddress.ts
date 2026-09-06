import { lookup } from 'node:dns/promises';
import { isIP } from 'node:net';
import { publicHost } from './publicHost';

let resolved: Promise<string> | null = null;

const resolve = async (host: string): Promise<string> => {
    if(isIP(host) || host === 'localhost') return host;
    try{
        return (await lookup(host, { family: 4 })).address;
    }catch{
        return host;
    }
};

export const publicAddress = (): Promise<string> => {
    resolved ??= resolve(publicHost());
    return resolved;
};
