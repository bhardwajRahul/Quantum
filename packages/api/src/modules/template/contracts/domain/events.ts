import type { TemplateInstallService } from '@quantum/contracts/modules/template/domain';

export interface TemplateInstalledPayload{
    templateInstallId: number;
    projectId: number;
    templateId: number | null;
    userId: number;
}

export interface TemplateDeletedPayload{
    templateId: number;
}

export interface TemplateUninstalledPayload{
    templateInstallId: number;
    userId: number | null;
    services: TemplateInstallService[];
    networkId: number | null;
}
