import SecretCipher from '@/shared/services/SecretCipher';
import { saveOrConflict } from '@/shared/models/isUniqueViolation';
import { assertOrg } from '@/shared/tenancy';
import GithubAccount from '@/modules/github/models/GithubAccount';
import RegistryCredential from '../models/RegistryCredential';
import { RegistryCredentialError } from '../contracts/domain/errors';
import { normalizeRegistry, registryOf, serverAddressOf } from './registryHost';
import type { Tenant } from '@/modules/organization/contracts/types/fastify';
import type { CreateRegistryCredentialInput } from '@quantum/contracts/modules/registry/http';

const GITHUB_REGISTRY = 'ghcr.io';

export interface RegistryAuth{
    username: string;
    password: string;
    serveraddress: string;
    source: 'credential' | 'github';
}

export interface PullScope{
    organizationId: number;
    userId: number | null;
}

export default class RegistryCredentialService{
    #cipher = new SecretCipher();

    async listForOrg(tenant: Tenant, orgId: number): Promise<RegistryCredential[]>{
        assertOrg(tenant, orgId, RegistryCredentialError.Forbidden);
        return RegistryCredential.find({ where: { organizationId: orgId }, order: { registry: 'ASC' } });
    }

    async create(tenant: Tenant, orgId: number, input: CreateRegistryCredentialInput): Promise<RegistryCredential>{
        assertOrg(tenant, orgId, RegistryCredentialError.Forbidden);

        const registry = normalizeRegistry(input.registry);
        if(registry === null) throw RegistryCredentialError.InvalidRegistry();
        if(input.username.trim() === '' || input.secret === '') throw RegistryCredentialError.InvalidRegistry();

        return saveOrConflict(RegistryCredential.create({
            organizationId: orgId,
            registry,
            username: input.username.trim(),
            secretEnc: this.#cipher.encrypt(input.secret)
        }).save(), RegistryCredentialError.AlreadyExists);
    }

    async remove(tenant: Tenant, id: number): Promise<void>{
        const credential = await RegistryCredential.findOneBy({ id });
        if(!credential) throw RegistryCredentialError.NotFound();
        assertOrg(tenant, credential.organizationId, RegistryCredentialError.Forbidden);
        await credential.remove();
    }

    async authFor(ref: string, scope: PullScope): Promise<RegistryAuth | null>{
        const registry = registryOf(ref);

        const credential = await RegistryCredential.findOneBy({ organizationId: scope.organizationId, registry });
        if(credential){
            return {
                username: credential.username,
                password: this.#cipher.decrypt(credential.secretEnc),
                serveraddress: serverAddressOf(registry),
                source: 'credential'
            };
        }

        if(registry !== GITHUB_REGISTRY || scope.userId === null) return null;
        const account = await GithubAccount.findOneBy({ userId: scope.userId });
        if(!account) return null;

        return {
            username: account.username,
            password: this.#cipher.decrypt(account.accessToken),
            serveraddress: registry,
            source: 'github'
        };
    }
}
