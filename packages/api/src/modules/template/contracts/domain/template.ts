import type { InputDef, TemplateInstallService, TemplateInstallStatus, TemplateSource, TemplateSpec } from '@quantum/contracts/modules/template/domain';

export interface TemplateFields{
    name: string;
    slug: string;
    description: string | null;
    icon: string | null;
    website: string | null;
    source: TemplateSource;
    organizationId: number | null;
    spec: TemplateSpec;
    inputsSchema: InputDef[];
    createdAt: Date;
    updatedAt: Date;
}

export interface TemplateInstallFields{
    name: string;
    templateId: number;
    projectId: number;
    environmentId: number | null;
    organizationId: number | null;
    userId: number | null;
    nodeId: string;
    inputsEnc: string | null;
    status: TemplateInstallStatus;
    networkId: number | null;
    services: TemplateInstallService[];
    createdAt: Date;
    updatedAt: Date;
}
