/***
 * Copyright (C) Rodolfo Herrera Hernandez. All rights reserved.
 * Licensed under the MIT license. See LICENSE file in the project root
 * for full license information.
 *
 * =+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+
 *
 * For related information - https://github.com/rodyherrera/Quantum/
 *
 * All your applications, just in one place.
 *
 * =-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-
****/

import { TemplateSpec, TemplateServiceSpec } from '@typings/models/template';

/**
 * PURE template-spec compiler (no I/O, no Docker, no Mongo — unit-tested). Normalizes
 * EITHER a docker-compose subset OR the legacy one-click parent/husband shape into a
 * single TemplateSpec, applying the security allowlist as it goes. The orchestrator
 * and seed both consume the normalized output, never the raw author input.
 *
 * SECURITY (defense at the boundary): a template can only describe a portable,
 * network-isolated multi-service app. It can NOT:
 *   - bind-mount host paths (only named/anonymous container volumes),
 *   - request `privileged`, `cap_add`, `devices`, `pid`/`ipc` host namespaces,
 *   - set `network_mode` (esp. host),
 *   - pin an arbitrary host port (host ports are auto-assigned by the platform).
 * Each violation throws Template::Compose::* so authoring/seed fails loudly.
 */

// Compose keys that grant host access or escape container isolation — rejected
// outright wherever they appear on a service.
const FORBIDDEN_SERVICE_KEYS = [
    'privileged', 'cap_add', 'devices', 'network_mode',
    'pid', 'ipc', 'userns_mode', 'security_opt', 'sysctls'
];

const fail = (code: string): never => {
    throw new Error(`Template::Compose::${code}`);
};

/**
 * Split an image reference into { name, tag }. Only the final path segment may
 * carry a tag (so a registry host:port like `localhost:5000/img` is not mistaken
 * for a tag). Defaults the tag to 'latest'.
 */
export const splitImageRef = (image: string): { name: string; tag: string } => {
    const ref = String(image).trim();
    const lastSlash = ref.lastIndexOf('/');
    const lastColon = ref.lastIndexOf(':');
    if(lastColon > lastSlash){
        return { name: ref.slice(0, lastColon), tag: ref.slice(lastColon + 1) || 'latest' };
    }
    return { name: ref, tag: 'latest' };
};

/** Normalize environment given as a map or a ["KEY=value"] array into a record. */
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

/** Normalize a command given as string or argv array into a single string. */
const normalizeCommand = (raw: any): string | undefined => {
    if(raw == null) return undefined;
    if(Array.isArray(raw)) return raw.map(String).join(' ');
    return String(raw);
};

/**
 * Normalize ports to container-internal targets only. Any published/host port
 * (e.g. "8080:80" or { published }) is REJECTED — host ports are platform-assigned.
 */
const normalizePorts = (raw: any): TemplateServiceSpec['ports'] => {
    if(!raw) return undefined;
    const list = Array.isArray(raw) ? raw : [raw];
    const ports: NonNullable<TemplateServiceSpec['ports']> = [];
    for(const entry of list){
        if(typeof entry === 'number' || typeof entry === 'string'){
            const str = String(entry).trim();
            // "host:container" / "ip:host:container" pins a host port — reject.
            if(str.includes(':')) fail('HostPort');
            const [portPart, proto] = str.split('/');
            const target = Number(portPart);
            if(!Number.isInteger(target) || target < 1 || target > 65535) fail('InvalidPort');
            ports.push({ target, protocol: proto || 'tcp' });
            continue;
        }
        if(entry && typeof entry === 'object'){
            // Legacy one-click shape uses { internalPort, protocol }.
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

/**
 * Normalize volumes to CONTAINER paths only. Rejects host bind mounts (a source
 * that is an absolute/relative host path). A named-volume `name:/path` keeps only
 * `/path` (the platform auto-creates the named volume per container).
 */
const normalizeVolumes = (raw: any): TemplateServiceSpec['volumes'] => {
    if(!raw) return undefined;
    const list = Array.isArray(raw) ? raw : [raw];
    const volumes: NonNullable<TemplateServiceSpec['volumes']> = [];
    const isHostPath = (src: string) => src.startsWith('/') || src.startsWith('.') || src.startsWith('~');
    for(const entry of list){
        if(typeof entry === 'string'){
            const parts = entry.split(':');
            if(parts.length === 1){
                // Anonymous container volume.
                volumes.push({ path: parts[0], mode: 'rw' });
            }else{
                const [src, dst, mode] = parts;
                // "/host:/container" → host bind mount: forbidden.
                if(isHostPath(src)) fail('HostBindMount');
                volumes.push({ path: dst, mode: mode === 'ro' ? 'ro' : 'rw' });
            }
            continue;
        }
        if(entry && typeof entry === 'object'){
            // Long compose form { type:'bind', source, target } → reject binds.
            if(entry.type === 'bind') fail('HostBindMount');
            if(entry.source && isHostPath(String(entry.source))) fail('HostBindMount');
            // Accept { path | target | containerPath }.
            const path = entry.path ?? entry.target ?? entry.containerPath;
            if(!path) fail('InvalidVolume');
            volumes.push({ path: String(path), mode: entry.mode === 'ro' ? 'ro' : 'rw' });
            continue;
        }
        fail('InvalidVolume');
    }
    return volumes.length ? volumes : undefined;
};

/** Assert a raw service object carries no host-escaping keys. */
const assertNoForbiddenKeys = (raw: any): void => {
    for(const key of FORBIDDEN_SERVICE_KEYS){
        if(raw[key] !== undefined && raw[key] !== false && raw[key] !== null){
            fail(`Forbidden::${key}`);
        }
    }
};

/**
 * Apply the command/environment/ports/volumes normalizations shared by the
 * compose-subset parser (normalizeService) and the legacy one-click parser
 * (parseLegacy.toService). The `?? raw.env` environment fallback is a no-op for
 * legacy entries (which only ever carry `environment`), so this is behavior-
 * preserving for both callers.
 */
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

/** Normalize one compose-subset service into a TemplateServiceSpec. */
const normalizeService = (raw: any): TemplateServiceSpec => {
    assertNoForbiddenKeys(raw);
    const service: TemplateServiceSpec = {};
    if(raw.image != null) service.image = String(raw.image);
    applyCommonServiceFields(service, raw);
    if(Array.isArray(raw.depends_on)){
        service.depends_on = raw.depends_on.map(String);
    }else if(raw.depends_on && typeof raw.depends_on === 'object'){
        // Compose long form { db: { condition } } → keys are the deps.
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

/** A service is "legacy one-click" when the doc has a top-level name + image. */
const isLegacyShape = (input: any): boolean =>
    !!input && typeof input === 'object' && !input.services &&
    (input.image !== undefined || Array.isArray(input.husbands) || input.name !== undefined);

/**
 * Normalize the legacy parent/husband one-click document into a TemplateSpec. The
 * parent keeps its `name` as the service key and depends_on all husbands; husband
 * names are preserved EXACTLY so `${husband.externalPort}` interpolation resolves.
 * Behavior-preserving: husbands stay plain containers (kind unset).
 */
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
    // The parent is the user-facing app: route the first port through ingress.
    if(parent.ports && parent.ports.length){
        parent.expose = { http: true, port: parent.ports[0].target };
    }
    services[parentName] = parent;

    for(const husband of husbands){
        services[String(husband.name)] = toService(husband);
    }
    return { services };
};

/**
 * Compute a dependency-respecting service order (dependencies first). Throws
 * Template::Compose::CyclicDependency on a cycle and ::UnknownDependency when a
 * depends_on names a service that doesn't exist.
 */
export const topologicalOrder = (spec: TemplateSpec): string[] => {
    const names = Object.keys(spec.services);
    const visited = new Map<string, number>(); // 0=visiting, 1=done
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

/**
 * Normalize ANY supported input (compose subset OR legacy one-click) into a
 * validated TemplateSpec, and verify the dependency graph is acyclic.
 */
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
    // Validate the dependency graph (acyclic + all deps exist).
    topologicalOrder(spec);
    return spec;
};

export default parseCompose;
