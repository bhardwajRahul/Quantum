import type { RepositoryOperation } from './domain';

export interface CreateRepositoryInput{
    /**
     * @minLength 1
     */
    name: string;
    /**
     * @minLength 1
     */
    url: string;
    owner?: string;
    /**
     * @minLength 4
     * @maxLength 32
     */
    alias?: string;
    branch?: string;
    buildCommand?: string;
    installCommand?: string;
    startCommand?: string;
    rootDirectory?: string;
    framework?: string;
    runtime?: string;
    runtimeVersion?: string;
    outputDirectory?: string;
    /**
     * @type int
     */
    port?: number;
    /**
     * @type int
     */
    projectId: number;
}

export interface UpdateRepositoryInput{
    /**
     * @minLength 1
     */
    name?: string;
    /**
     * @minLength 1
     */
    url?: string;
    owner?: string;
    /**
     * @minLength 4
     * @maxLength 32
     */
    alias?: string;
    branch?: string;
    buildCommand?: string;
    installCommand?: string;
    startCommand?: string;
    rootDirectory?: string;
    framework?: string;
    runtime?: string;
    runtimeVersion?: string;
    outputDirectory?: string;
    /**
     * @type int
     */
    port?: number;
    /**
     * @type int
     */
    projectId?: number;
}

export interface RepositoryOperationInput{
    operation: RepositoryOperation;
}

export interface StorageWriteInput{
    /**
     * @minLength 1
     */
    path: string;
    /**
     * @minLength 1
     */
    content: string;
}
