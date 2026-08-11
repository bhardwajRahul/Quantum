export interface TemplateInstalledPayload{
    templateInstallId: number;
    projectId: number;
    templateId: number;
    userId: number;
}

export interface TemplateDeletedPayload{
    templateId: number;
}
