import { TemplateSpec } from '@typings/models/template';

export interface ServicePortInfo{
    externalPort?: number;

    portMap?: Record<number, number>;
}

export type ServicePortBindings = Record<string, ServicePortInfo>;

const SERVER_IP_TOKEN = /\{server_ip\}/g;

const REFERENCE_TOKEN = /\$\{([^}]+)\}/g;

const fail = (code: string): never => {
    throw new Error(`Template::Interpolate::${code}`);
};

const resolveReference = (
    reference: string,
    inputs: Record<string, string>,
    ports: ServicePortBindings
): string => {
    const dot = reference.indexOf('.');
    if(dot === -1) fail(`BadReference::${reference}`);
    const head = reference.slice(0, dot);
    const prop = reference.slice(dot + 1);

    if(head === 'input'){
        if(!(prop in inputs)) fail(`UnknownInput::${prop}`);
        return inputs[prop];
    }

    if(prop !== 'externalPort'){
        return fail(`UnknownProperty::${reference}`);
    }
    const info = ports[head];
    if(!info || info.externalPort == null){
        return fail(`UnknownService::${head}`);
    }
    return String(info.externalPort);
};

const resolveValue = (
    raw: string,
    serviceName: string,
    inputs: Record<string, string>,
    ports: ServicePortBindings,
    serverIp: string
): string => {
    let value = raw.replace(SERVER_IP_TOKEN, serverIp);

    value = value.replace(REFERENCE_TOKEN, (_match, reference: string) =>
        resolveReference(String(reference).trim(), inputs, ports));

    const selfPortMap = ports[serviceName]?.portMap;
    if(selfPortMap){
        value = value.replace(/:(\d+)/g, (match, digits: string) => {
            const internal = Number(digits);
            const external = selfPortMap[internal];
            return external ? `:${external}` : match;
        });
    }
    return value;
};

export const resolveEnv = (
    spec: TemplateSpec,
    inputs: Record<string, string>,
    serviceContainersPortMap: ServicePortBindings,
    options: { serverIp?: string } = {}
): Record<string, Record<string, string>> => {
    const serverIp = options.serverIp || process.env.SERVER_IP || 'localhost';
    const result: Record<string, Record<string, string>> = {};

    for(const [serviceName, service] of Object.entries(spec.services)){
        const resolved: Record<string, string> = {};
        const environment = service.environment || {};
        for(const [key, raw] of Object.entries(environment)){
            resolved[key] = resolveValue(String(raw), serviceName, inputs, serviceContainersPortMap, serverIp);
        }
        result[serviceName] = resolved;
    }
    return result;
};

export default resolveEnv;
