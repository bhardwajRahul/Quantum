import type { BaseEntity } from '../../shared/base';

export enum EnvironmentType{
    Production = 'production',
    Staging = 'staging',
    Preview = 'preview'
}

export interface Project extends BaseEntity{
    name: string;
    slug: string;
    isDefault: boolean;
    organizationId: number;
}

export interface Environment extends BaseEntity{
    name: string;
    type: EnvironmentType;
    isDefault: boolean;
    projectId: number;
    organizationId: number;
}
