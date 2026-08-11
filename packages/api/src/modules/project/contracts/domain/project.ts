import type { EnvironmentType } from '@quantum/contracts/modules/project/domain';

export interface ProjectFields{
    name: string;
    slug: string;
    organizationId: number;
    isDefault: boolean;
    createdAt: Date;
    updatedAt: Date;
}

export interface EnvironmentFields{
    name: string;
    type: EnvironmentType;
    projectId: number;
    organizationId: number;
    isDefault: boolean;
    createdAt: Date;
    updatedAt: Date;
}
