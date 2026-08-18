import { TemplateSpec, TemplateServiceSpec } from '@typings/models/template';

const FORBIDDEN_SERVICE_KEYS = [
    'privileged', 'cap_add', 'devices', 'network_mode',
    'pid', 'ipc', 'userns_mode', 'security_opt', 'sysctls'
];

const fail = (code: string): never => {
    throw new Error(`Template::Compose::${code}`);
};

export const splitImageRef = (image: string): { name: string; tag: string } => {
    const ref = String(image).trim();
    const lastSlash = ref.lastIndexOf('/');
    const lastColon = ref.lastIndexOf(':');
    if(lastColon > lastSlash){
        return { name: ref.slice(0, lastColon), tag: ref.slice(lastColon + 1) || 'latest' };
    }
    return { name: ref, tag: 'latest' };
};

const normalizeEnvironment = (raw: any): Record<string, string> | undefined => {
    if(!raw) return undefined;
    const out: Record<string, string> = {};
    if(Array.isArray(raw)){
        for(const entry of raw){
            const str = String(entry);
            const eq = str.indexOf('=');
            if(eq === -1){ out[str] = ''; continue; }
            out[str.slice(0, eq)] = str.slice(eq + 1);
        }
        return out;
    }
    if(typeof raw === 'object'){
        for(const [key, value] of Object.entries(raw)){
            out[key] = value == null ? '' : String(value);
        }
        return out;
    }
    return undefined;
};

const normalizeCommand = (raw: any): string | undefined => {
    if(raw == null) return undefined;
    if(Array.isArray(raw)) return raw.map(String).join(' ');
    return String(raw);
};

const normalizePorts = (raw: any): TemplateServiceSpec['ports'] => {
    if(!raw) return undefined;
    const list = Array.isArray(raw) ? raw : [raw];
    const ports: NonNullable<TemplateServiceSpec['ports']> = [];
    for(const entry of list){
        if(typeof entry === 'number' || typeof entry === 'string'){
            const str = String(entry).trim();

            if(str.includes(':')) fail('HostPort');
            const [portPart, proto] = str.split('/');
            const target = Number(portPart);
            if(!Number.isInteger(target) || target < 1 || target > 65535) fail('InvalidPort');
            ports.push({ target, protocol: proto || 'tcp' });
            continue;
        }
        if(entry && typeof entry === 'object'){

            const targetRaw = entry.target ?? entry.internalPort ?? entry.containerPort;
            if(entry.published != null || entry.host_ip != null || entry.hostPort != null){
                fail('HostPort');
            }
            const target = Number(targetRaw);
            if(!Number.isInteger(target) || target < 1 || target > 65535) fail('InvalidPort');
            ports.push({ target, protocol: entry.protocol || 'tcp' });
            continue;
        }
        fail('InvalidPort');
    }
    return ports.length ? ports : undefined;
};

const normalizeVolumes = (raw: any): TemplateServiceSpec['volumes'] => {
    if(!raw) return undefined;
    const list = Array.isArray(raw) ? raw : [raw];
    const volumes: NonNullable<TemplateServiceSpec['volumes']> = [];
    const isHostPath = (src: string) => src.startsWith('/') || src.startsWith('.') || src.startsWith('~');
    for(const entry of list){
        if(typeof entry === 'string'){
            const parts = entry.split(':');
            if(parts.length === 1){

                volumes.push({ path: parts[0], mode: 'rw' });
            }else{
                const [src, dst, mode] = parts;

                if(isHostPath(src)) fail('HostBindMount');
                volumes.push({ path: dst, mode: mode === 'ro' ? 'ro' : 'rw' });
            }
            continue;
        }
        if(entry && typeof entry === 'object'){

            if(entry.type === 'bind') fail('HostBindMount');
            if(entry.source && isHostPath(String(entry.source))) fail('HostBindMount');

            const path = entry.path ?? entry.target ?? entry.containerPath;
            if(!path) fail('InvalidVolume');
            volumes.push({ path: String(path), mode: entry.mode === 'ro' ? 'ro' : 'rw' });
            continue;
        }
        fail('InvalidVolume');
    }
    return volumes.length ? volumes : undefined;
};

const assertNoForbiddenKeys = (raw: any): void => {
    for(const key of FORBIDDEN_SERVICE_KEYS){
        if(raw[key] !== undefined && raw[key] !== false && raw[key] !== null){
            fail(`Forbidden::${key}`);
        }
    }
};

const applyCommonServiceFields = (service: TemplateServiceSpec, raw: any): void => {
    const command = normalizeCommand(raw.command);
    if(command) service.command = command;
    const environment = normalizeEnvironment(raw.environment ?? raw.env);
    if(environment) service.environment = environment;
    const ports = normalizePorts(raw.ports);
    if(ports) service.ports = ports;
    const volumes = normalizeVolumes(raw.volumes);
    if(volumes) service.volumes = volumes;
};

const normalizeService = (raw: any): TemplateServiceSpec => {
    assertNoForbiddenKeys(raw);
    const service: TemplateServiceSpec = {};
    if(raw.image != null) service.image = String(raw.image);
    applyCommonServiceFields(service, raw);
    if(Array.isArray(raw.depends_on)){
        service.depends_on = raw.depends_on.map(String);
    }else if(raw.depends_on && typeof raw.depends_on === 'object'){

        service.depends_on = Object.keys(raw.depends_on);
    }
    if(raw.expose && typeof raw.expose === 'object'){
        service.expose = {
            http: !!raw.expose.http,
            ...(raw.expose.port ? { port: Number(raw.expose.port) } : {})
        };
    }
    if(raw.kind === 'database' || raw.kind === 'app') service.kind = raw.kind;
    if(raw.engine) service.engine = String(raw.engine);
    return service;
};

const isLegacyShape = (input: any): boolean =>
    !!input && typeof input === 'object' && !input.services &&
    (input.image !== undefined || Array.isArray(input.husbands) || input.name !== undefined);

const parseLegacy = (input: any): TemplateSpec => {
    const services: TemplateSpec['services'] = {};

    const toService = (entry: any): TemplateServiceSpec => {
        const service: TemplateServiceSpec = {};
        if(entry.image){
            const tag = entry.image.tag != null ? String(entry.image.tag) : 'latest';
            service.image = `${entry.image.name}:${tag}`;
        }
        applyCommonServiceFields(service, entry);
        return service;
    };

    const parentName = String(input.name);
    const parent = toService(input);
    const husbands: any[] = Array.isArray(input.husbands) ? input.husbands : [];
    if(husbands.length){
        parent.depends_on = husbands.map((h) => String(h.name));
    }

    if(parent.ports && parent.ports.length){
        parent.expose = { http: true, port: parent.ports[0].target };
    }
    services[parentName] = parent;

    for(const husband of husbands){
        services[String(husband.name)] = toService(husband);
    }
    return { services };
};

export const topologicalOrder = (spec: TemplateSpec): string[] => {
    const names = Object.keys(spec.services);
    const visited = new Map<string, number>();
    const order: string[] = [];

    const visit = (name: string, stack: string[]): void => {
        const state = visited.get(name);
        if(state === 1) return;
        if(state === 0) fail('CyclicDependency');
        visited.set(name, 0);
        const deps = spec.services[name]?.depends_on || [];
        for(const dep of deps){
            if(!spec.services[dep]) fail('UnknownDependency');
            visit(dep, [...stack, name]);
        }
        visited.set(name, 1);
        order.push(name);
    };

    for(const name of names) visit(name, []);
    return order;
};

export const parseCompose = (input: any): TemplateSpec => {
    if(!input || typeof input !== 'object') fail('InvalidInput');

    let spec: TemplateSpec;
    if(isLegacyShape(input)){
        spec = parseLegacy(input);
    }else if(input.services && typeof input.services === 'object'){
        const services: TemplateSpec['services'] = {};
        for(const [name, raw] of Object.entries(input.services)){
            if(!raw || typeof raw !== 'object') fail('InvalidService');
            services[name] = normalizeService(raw);
        }
        spec = { services };
    }else{
        return fail('UnrecognizedShape');
    }

    if(Object.keys(spec.services).length === 0) fail('NoServices');

    topologicalOrder(spec);
    return spec;
};

export default parseCompose;
