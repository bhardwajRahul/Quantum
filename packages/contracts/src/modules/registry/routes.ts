import { del, get, post } from '../../shared/routing';
import type { CreateRegistryCredentialInput } from './http';
import type { RegistryCredential } from './domain';

export const registryCredentialRoutes = {
    listByOrganization: get<RegistryCredential[]>('/registry/organization/:orgId'),
    create: post<CreateRegistryCredentialInput, RegistryCredential>('/registry/organization/:orgId'),
    remove: del('/registry/:id')
};
