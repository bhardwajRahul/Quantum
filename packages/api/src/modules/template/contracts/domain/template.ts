import type {
    InputDef,
    ServiceEnvironment,
    TemplateInstallService,
    TemplateInstallStatus,
    TemplateSource,
    TemplateSpec
} from '@quantum/contracts/modules/template/domain';

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
    templateId: number | null;
    compose: string | null;
    spec: TemplateSpec | null;
    projectId: number;
    organizationId: number | null;
    userId: number | null;
    nodeId: string;
    inputsEnc: string | null;
    status: TemplateInstallStatus;
    networkId: number | null;
    services: TemplateInstallService[];
    environment: ServiceEnvironment;
    createdAt: Date;
    updatedAt: Date;
}
