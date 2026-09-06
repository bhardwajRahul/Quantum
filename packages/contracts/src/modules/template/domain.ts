import type { BaseEntity } from '../../shared/base';
import type { ContainerAddress } from '../docker/domain';

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

export interface TemplateServiceBuild{
    context: string;
    dockerfile?: string;
    args?: Record<string, string>;
    target?: string;
}

export interface TemplateServiceSpec{
    image?: string;
    build?: TemplateServiceBuild;
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
    address: ContainerAddress | null;
}

export type ServiceEnvironment = Record<string, Record<string, string>>;

export interface TemplateInstall extends BaseEntity{
    name: string;
    templateId: number | null;
    compose: string | null;
    projectId: number;
    organizationId: number | null;
    userId: number | null;
    nodeId: string;
    status: TemplateInstallStatus;
    networkId: number | null;
    services: TemplateInstallService[];
    environment: ServiceEnvironment;
    source: StackSource | null;
}

export interface TemplateInstallServiceEnvironment{
    name: string;
    environmentVariables: Record<string, string>;
}

export interface TemplateInstallEnvironment{
    installId: number;
    services: TemplateInstallServiceEnvironment[];
}

export type StackDeployTrigger = 'push' | 'release';

export interface StackSource{
    owner: string;
    repo: string;
    branch: string;
    composePath: string;
    deployOn: StackDeployTrigger;
}

export interface ComposeVariable{
    name: string;
    required: boolean;
}

export interface StackSourceInspection{
    composeFiles: string[];
    composePath: string | null;
    variables: ComposeVariable[];
    problem: string | null;
}
