import typia from 'typia';
import type { IValidation } from 'typia';
import type { CreateRepositoryInput } from '@quantum/contracts/modules/repository/http';

export interface CreateRepositoryFormValues{
    projectId: number;
    name: string;
    url: string;
    alias: string;
    branch: string;
    framework: string;
    runtime: string;
    runtimeVersion: string;
    installCommand: string;
    buildCommand: string;
    startCommand: string;
    outputDirectory: string;
    port: string;
}

export const CREATE_REPOSITORY_INITIAL_VALUES: CreateRepositoryFormValues = {
    projectId: 0,
    name: '',
    url: '',
    alias: '',
    branch: '',
    framework: '',
    runtime: '',
    runtimeVersion: '',
    installCommand: '',
    buildCommand: '',
    startCommand: '',
    outputDirectory: '',
    port: ''
};

export const RUNTIME_OPTIONS: Array<{ value: string; label: string }> = [
    { value: 'node', label: 'Node.js' },
    { value: 'python', label: 'Python' },
    { value: 'go', label: 'Go' },
    { value: 'static', label: 'Static' }
];

export const FRAMEWORK_OPTIONS: string[] = [
    'Next.js',
    'Nuxt',
    'Remix',
    'Astro',
    'Vite',
    'Create React App',
    'Node',
    'Python',
    'Go',
    'Static'
];

const optional = (value: string): string | undefined => {
    const trimmed = value.trim();
    return trimmed === '' ? undefined : trimmed;
};

export const toCreateRepositoryInput = (values: CreateRepositoryFormValues): CreateRepositoryInput => {
    const alias = optional(values.alias);
    const branch = optional(values.branch);
    const framework = optional(values.framework);
    const runtime = optional(values.runtime);
    const runtimeVersion = optional(values.runtimeVersion);
    const installCommand = optional(values.installCommand);
    const buildCommand = optional(values.buildCommand);
    const startCommand = optional(values.startCommand);
    const outputDirectory = optional(values.outputDirectory);
    const port = optional(values.port);

    return {
        projectId: values.projectId,
        name: values.name.trim(),
        url: values.url.trim(),
        ...(alias !== undefined ? { alias } : {}),
        ...(branch !== undefined ? { branch } : {}),
        ...(framework !== undefined ? { framework } : {}),
        ...(runtime !== undefined ? { runtime } : {}),
        ...(runtimeVersion !== undefined ? { runtimeVersion } : {}),
        ...(installCommand !== undefined ? { installCommand } : {}),
        ...(buildCommand !== undefined ? { buildCommand } : {}),
        ...(startCommand !== undefined ? { startCommand } : {}),
        ...(outputDirectory !== undefined ? { outputDirectory } : {}),
        ...(port !== undefined ? { port: Number(port) } : {})
    };
};

const validateInput = typia.createValidate<CreateRepositoryInput>();

export const validateCreateRepositoryForm = (input: unknown): IValidation<CreateRepositoryInput> => {
    const values = input as CreateRepositoryFormValues;
    if(values.projectId === 0){
        return {
            success: false,
            data: input,
            errors: [{ path: '$input.projectId', expected: 'a selected project', value: values.projectId }]
        };
    }

    return validateInput(toCreateRepositoryInput(values));
};
