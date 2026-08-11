import type { TemplateCategory, TemplateSource, TemplateSpec } from '@quantum/contracts/modules/template/domain';

export interface TemplateFields{
    name: string;
    slug: string;
    version: string;
    category: TemplateCategory;
    description: string | null;
    icon: string | null;
    website: string | null;
    source: TemplateSource;
    organizationId: number | null;
    spec: TemplateSpec;
    createdAt: Date;
    updatedAt: Date;
}

export interface TemplateInstallFields{
    name: string;
    templateId: number;
    templateVersion: string;
    projectId: number;
    environmentId: number | null;
    organizationId: number | null;
    userId: number | null;
    nodeId: string;
    createdAt: Date;
    updatedAt: Date;
}
