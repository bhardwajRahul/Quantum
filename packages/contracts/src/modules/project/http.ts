import type { EnvironmentType } from './domain';

export interface CreateProjectInput{
    name: string;
}

export interface UpdateProjectInput{
    name?: string;
}

export interface CreateEnvironmentInput{
    name: string;
    type: EnvironmentType;
}

export interface UpdateEnvironmentInput{
    name?: string;
    type?: EnvironmentType;
}
