import type { PortBindingProtocol } from './domain';

export interface CreateCodespaceInput{
    /**
     * @minLength 1
     * @pattern ^.*\S.*$
     */
    name: string;
    /**
     * @type uint
     * @minimum 1
     * @maximum 8
     */
    cpuCores?: number;
    /**
     * @type uint
     * @minimum 512
     * @maximum 16384
     */
    memoryMb?: number;
    /**
     * @type uint
     * @minimum 1
     * @maximum 100
     */
    diskGb?: number;
}

export interface CreatePortBindingInput{
    /**
     * @type uint
     * @minimum 1
     */
    containerId: number;
    /**
     * @type uint
     * @minimum 1
     * @maximum 65535
     */
    internalPort: number;
    /**
     * @type uint
     * @minimum 1
     * @maximum 65535
     */
    externalPort: number;
    protocol?: PortBindingProtocol;
}
