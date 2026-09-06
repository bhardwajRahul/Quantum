import type { BaseEntity } from '../../shared/base';

export interface Project extends BaseEntity{
    name: string;
    slug: string;
    isDefault: boolean;
    organizationId: number;
}
