import { parse } from 'yaml';
import { TemplateInstallError } from '../contracts/domain/errors';
import type {
    TemplateServicePort,
    TemplateServiceSpec,
    TemplateServiceVolume,
    TemplateSpec
} from '@quantum/contracts/modules/template/domain';

type Mapping = Record<string, unknown>;

const isMapping = (value: unknown): value is Mapping =>
    typeof value === 'object' && value !== null && !Array.isArray(value);

const invalid = (detail: string): never => {
    throw TemplateInstallError.InvalidCompose(detail);
};

const unsupported = (detail: string): never => {
    throw TemplateInstallError.UnsupportedCompose(detail);
};

const SHELL_SAFE = /^[\w@%+=:,./-]+$/;

const shellWord = (word: string): string =>
    SHELL_SAFE.test(word) ? word : `'${word.replace(/'/g, `'\\''`)}'`;

const parseDocument = (source: string): Mapping => {
    let document: unknown;
    try{
        document = parse(source);
    }catch(error){
        return invalid(`yaml:${(error as Error).message.split('\n')[0]}`);
    }
    if(!isMapping(document)) return invalid('document');
    return document;
};

const toCommand = (name: string, value: unknown): string | undefined => {
    if(value === undefined || value === null) return undefined;
    if(typeof value === 'string') return value;
    if(Array.isArray(value) && value.every((part) => typeof part === 'string' || typeof part === 'number')){
        return value.map((part) => shellWord(String(part))).join(' ');
    }
    return invalid(`command:${name}`);
};

const toEnvironment = (name: string, value: unknown): Record<string, string> | undefined => {
    if(value === undefined || value === null) return undefined;

    if(Array.isArray(value)){
        const environment: Record<string, string> = {};
        for(const entry of value){
            if(typeof entry !== 'string') return invalid(`environment:${name}`);
            const separator = entry.indexOf('=');
            if(separator === -1) environment[entry] = '';
            else environment[entry.slice(0, separator)] = entry.slice(separator + 1);
        }
        return environment;
    }

    if(!isMapping(value)) return invalid(`environment:${name}`);
    return Object.fromEntries(
        Object.entries(value).map(([key, raw]) => [key, raw === null || raw === undefined ? '' : String(raw)])
    );
};

const portNumber = (name: string, raw: string): number => {
    const port = Number(raw);
    if(!Number.isInteger(port) || port < 1 || port > 65535) return invalid(`ports:${name}:${raw}`);
    return port;
};

const toPort = (name: string, value: unknown): TemplateServicePort => {
    if(typeof value === 'number') return { target: portNumber(name, String(value)) };

    if(typeof value === 'string'){
        const [mapping, protocol] = value.split('/');
        const segments = mapping.split(':');
        return { target: portNumber(name, segments[segments.length - 1]), protocol };
    }

    if(isMapping(value) && (typeof value.target === 'number' || typeof value.target === 'string')){
        return {
            target: portNumber(name, String(value.target)),
            protocol: typeof value.protocol === 'string' ? value.protocol : undefined
        };
    }

    return invalid(`ports:${name}`);
};

const isHostPath = (source: string): boolean => /^(\/|\.\.?\/|~|[A-Za-z]:\\)/.test(source);

const toVolume = (name: string, value: unknown): TemplateServiceVolume => {
    if(typeof value === 'string'){
        const segments = value.split(':');
        if(segments.length === 1) return { path: segments[0] };
        if(segments.length > 3) return invalid(`volumes:${name}:${value}`);
        if(isHostPath(segments[0])) return unsupported(`bind-mount:${name}:${segments[0]}`);
        return { path: segments[1], mode: segments[2] };
    }

    if(isMapping(value) && typeof value.target === 'string'){
        if(value.type === 'bind') return unsupported(`bind-mount:${name}:${String(value.source ?? '')}`);
        return { path: value.target, mode: value.read_only === true ? 'ro' : undefined };
    }

    return invalid(`volumes:${name}`);
};

const toDependencies = (name: string, value: unknown): string[] | undefined => {
    if(value === undefined || value === null) return undefined;
    if(Array.isArray(value) && value.every((entry) => typeof entry === 'string')) return value as string[];
    if(isMapping(value)) return Object.keys(value);
    return invalid(`depends_on:${name}`);
};

const toList = <T>(name: string, key: string, value: unknown, convert: (entry: unknown) => T): T[] | undefined => {
    if(value === undefined || value === null) return undefined;
    if(!Array.isArray(value)) return invalid(`${key}:${name}`);
    return value.map(convert);
};

const toService = (name: string, value: unknown): TemplateServiceSpec => {
    if(!isMapping(value)) return invalid(`service:${name}`);
    if(value.build !== undefined) return unsupported(`build:${name}`);
    if(typeof value.image !== 'string' || value.image.trim() === '') return invalid(`image:${name}`);

    return {
        image: value.image.trim(),
        command: toCommand(name, value.command),
        environment: toEnvironment(name, value.environment),
        ports: toList(name, 'ports', value.ports, (entry) => toPort(name, entry)),
        volumes: toList(name, 'volumes', value.volumes, (entry) => toVolume(name, entry)),
        depends_on: toDependencies(name, value.depends_on),
        kind: 'app'
    };
};

export const composeToSpec = (source: string): TemplateSpec => {
    const document = parseDocument(source);
    if(!isMapping(document.services) || Object.keys(document.services).length === 0) return invalid('services');

    const services: Record<string, TemplateServiceSpec> = {};
    for(const [name, value] of Object.entries(document.services)){
        services[name] = toService(name, value);
    }

    for(const [name, service] of Object.entries(services)){
        for(const dependency of service.depends_on ?? []){
            if(!(dependency in services)) return invalid(`depends_on:${name}:${dependency}`);
        }
    }

    return { services };
};
