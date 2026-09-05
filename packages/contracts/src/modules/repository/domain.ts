import type { ContainerStatus } from '../docker/domain';
import type { PortBindingProtocol } from '../codespace/domain';
import type { BaseEntity } from '../../shared/base';

export enum BuildStrategy{
    Auto = 'auto',
    Dockerfile = 'dockerfile',
    PrebuiltImage = 'prebuilt-image',
    Exec = 'exec'
}

export enum SourceType{
    Github = 'github'
}

export enum RepositoryOperation{
    Start = 'start',
    Stop = 'stop',
    Restart = 'restart'
}

export interface RepositoryPort{
    /** Port the application listens on inside the container. */
    internalPort: number;
    /** Port published on the host, which is what a browser connects to. */
    externalPort: number;
    protocol: PortBindingProtocol;
}

export interface Repository extends BaseEntity{
    name: string;
    alias: string;
    owner: string | null;
    branch: string;
    webhookId: string | null;
    buildCommand: string;
    installCommand: string;
    startCommand: string;
    rootDirectory: string;
    framework: string | null;
    runtime: string | null;
    runtimeVersion: string | null;
    outputDirectory: string | null;
    buildStrategy: BuildStrategy;
    dockerfilePath: string | null;
    image: string | null;
    url: string;
    port: number | null;
    /**
     * Runtime state of this repository's container, read from the container row at
     * request time — the one place the orchestrator writes it. `null` means no container
     * has been provisioned yet. It is deliberately not a stored column: a copy would be
     * one more thing that can disagree with Docker.
     */
    containerStatus: ContainerStatus | null;
    /** Host ports this repository's container publishes, read from its bindings. */
    ports: RepositoryPort[];
    userId: number;
    organizationId: number | null;
    projectId: number;
    environmentId: number | null;
    sourceType: SourceType;
}

export interface RollbackAccepted{
    repositoryId: number;
    deploymentId: number;
}

export type WebhookOutcome =
    | { ok: true }
    | { skipped: true; reason: 'branch-mismatch' }
    | { skipped: false };
