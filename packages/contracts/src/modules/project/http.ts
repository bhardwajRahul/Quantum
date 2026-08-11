import type { EnvironmentType } from './domain';

export interface CreateProjectInput{
    /**
     * @maxLength 64
     */
    name: string;
}

export interface UpdateProjectInput{
    /**
     * @maxLength 64
     */
    name?: string;
}

export interface CreateEnvironmentInput{
    /**
     * @minLength 1
     */
    name: string;
    type: EnvironmentType;
}

export interface UpdateEnvironmentInput{
    name?: string;
    type?: EnvironmentType;
}
