import RegistryCredentialService from '@/modules/registry/services/RegistryCredentialService';
import { registryOf } from '@/modules/registry/services/registryHost';
import type Dockerode from 'dockerode';
import type { PullScope, RegistryAuth } from '@/modules/registry/services/RegistryCredentialService';

const DENIED = /unauthorized|denied|authentication required|\b40[13]\b/i;

const deniedMessage = (ref: string, auth: RegistryAuth | null): string => {
    const registry = registryOf(ref);
    const reason = auth === null
        ? `${registry} requires credentials`
        : auth.source === 'github'
            ? `${registry} refused the connected GitHub account (${auth.username}); it needs the read:packages scope`
            : `${registry} refused the stored credentials for ${auth.username}`;
    return `Could not pull ${ref}: ${reason}. Manage registry credentials under Settings → Organization.`;
};

export const pullImage = async (docker: Dockerode, ref: string, scope: PullScope): Promise<void> => {
    const auth = await new RegistryCredentialService().authFor(ref, scope);
    const options = auth === null
        ? {}
        : { authconfig: { username: auth.username, password: auth.password, serveraddress: auth.serveraddress } };

    try{
        const stream = await docker.pull(ref, options);
        await new Promise<void>((resolve, reject) => {
            docker.modem.followProgress(stream, (error: Error | null) => (error ? reject(error) : resolve()));
        });
    }catch(error){
        const message = error instanceof Error ? error.message : String(error);
        if(DENIED.test(message)) throw new Error(deniedMessage(ref, auth));
        throw error;
    }
};
