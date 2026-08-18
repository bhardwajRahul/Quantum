export type { ITemplate } from '@models/template';

export interface InputDef{
    key: string;
    label: string;
    type: 'string' | 'number' | 'boolean' | 'secret';
    default?: string | number | boolean;
    required?: boolean;

    generate?: 'password' | 'token';
}

export interface TemplateServiceSpec{

    image?: string;
    command?: string;
    environment?: Record<string, string>;

    ports?: { target: number; protocol?: string }[];

    volumes?: { path: string; mode?: string }[];
    depends_on?: string[];

    expose?: { http?: boolean; port?: number };

    kind?: 'app' | 'database';
    engine?: string;
}

export interface TemplateSpec{
    services: { [name: string]: TemplateServiceSpec };
}

export type TemplateSource = 'builtin' | 'custom';
