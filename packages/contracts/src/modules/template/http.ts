import type { InputDef, ServiceEnvironment, StackDeployTrigger, TemplateSpec } from './domain';

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
    inputs?: Record<string, string | number | boolean>;
}

export interface CreateComposeInstallInput{
    name: string;
    compose: string;
}

export interface UpdateComposeInput{
    compose: string;
}

export interface UpdateTemplateInstallEnvironmentInput{
    environment: ServiceEnvironment;
}

export interface InspectStackSourceInput{
    owner: string;
    repo: string;
    branch: string;
    composePath?: string;
}

export interface CreateSourceInstallInput{
    name: string;
    owner: string;
    repo: string;
    branch: string;
    composePath: string;
    deployOn: StackDeployTrigger;
    variables?: Record<string, string>;
}

export interface UpdateStackSourceInput{
    branch: string;
    composePath: string;
    deployOn: StackDeployTrigger;
}

export interface UpdateStackVariablesInput{
    variables: Record<string, string>;
}
