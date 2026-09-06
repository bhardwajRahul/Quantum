import type { BaseEntity } from '../../shared/base';

export interface RegistryCredential extends BaseEntity{
    organizationId: number;
    registry: string;
    username: string;
}
