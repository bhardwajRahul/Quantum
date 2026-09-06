import type { BaseEntity } from '../../shared/base';

export enum TemplateSource{
    Builtin = 'builtin',
    Custom = 'custom'
}

export interface TemplateServicePort{
    target: number;
    protocol?: string;
}

export interface TemplateServiceVolume{
    path: string;
    mode?: string;
}

export interface TemplateServiceExpose{
    http?: boolean;
    port?: number;
}

export interface TemplateServiceSpec{
    image?: string;
    command?: string;
    environment?: Record<string, string>;
    ports?: TemplateServicePort[];
    volumes?: TemplateServiceVolume[];
    depends_on?: string[];
    expose?: TemplateServiceExpose;
    kind?: 'app' | 'database';
    engine?: string;
}

export interface TemplateSpec{
    services: Record<string, TemplateServiceSpec>;
}

export type TemplateInputType = 'string' | 'number' | 'boolean' | 'secret';

export interface InputDef{
    key: string;
    label: string;
    type: TemplateInputType;
    default?: string | number | boolean;
    required?: boolean;
    generate?: 'password' | 'token';
}

export interface Template extends BaseEntity{
    name: string;
    slug: string;
    description: string | null;
    icon: string | null;
    website: string | null;
    source: TemplateSource;
    organizationId: number | null;
    spec: TemplateSpec;
    inputsSchema: InputDef[];
}

export enum TemplateInstallStatus{
    Pending = 'pending',
    Provisioning = 'provisioning',
    Running = 'running',
    Stopped = 'stopped',
    Error = 'error'
}

export interface TemplateInstallPort{
    internalPort: number;
    externalPort: number;
    protocol: string;
}

export interface TemplateInstallService{
    name: string;
    kind: 'app' | 'database';
    image: string;
    containerId: number | null;
    ports: TemplateInstallPort[];
}

export interface TemplateInstall extends BaseEntity{
    name: string;
    templateId: number;
    projectId: number;
    organizationId: number | null;
    userId: number | null;
    nodeId: string;
    status: TemplateInstallStatus;
    networkId: number | null;
    services: TemplateInstallService[];
}
