import type { InputDef, TemplateSpec } from './domain';

export interface CreateTemplateInput{
    name: string;
    slug?: string;
    description?: string;
    icon?: string;
    website?: string;
    spec: TemplateSpec;
    inputsSchema?: InputDef[];
}

export type TemplateInstallOperation = 'start' | 'stop' | 'restart';

export interface TemplateInstallOperationInput{
    operation: TemplateInstallOperation;
}

export interface InstallTemplateInput{
    templateId: number;
    name: string;
    environmentId?: number | null;
    inputs?: Record<string, string | number | boolean>;
}
