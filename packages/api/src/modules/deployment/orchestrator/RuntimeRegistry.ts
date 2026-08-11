export type Runtime = 'node' | 'python' | 'go' | 'static';

export const RUNTIME_IMAGES: Record<Runtime, { versions: Record<string, string>; default: string }> = {
    node: { versions: { '18': 'node:18-alpine', '20': 'node:20-alpine', '22': 'node:22-alpine' }, default: '20' },
    python: { versions: { '3.11': 'python:3.11-alpine', '3.12': 'python:3.12-alpine' }, default: '3.12' },
    go: { versions: { '1.22': 'golang:1.22-alpine' }, default: '1.22' },
    static: { versions: { '1': 'nginx:alpine' }, default: '1' }
};

export const DEFAULT_PORTS: Record<Runtime, number> = { node: 3000, python: 8000, go: 8080, static: 80 };

const has = (table: object, key?: string | null): boolean =>
    typeof key === 'string' && Object.prototype.hasOwnProperty.call(table, key);

export const getRuntimeImage = (runtime?: string | null, version?: string | null): { name: string; tag: string } => {
    const key: Runtime = has(RUNTIME_IMAGES, runtime) ? (runtime as Runtime) : 'node';
    const entry = RUNTIME_IMAGES[key] ?? RUNTIME_IMAGES.node;
    const image = has(entry.versions, version) ? entry.versions[version as string] : entry.versions[entry.default];
    const [name, tag] = (image ?? '').split(':');
    return name && tag ? { name, tag } : { name: 'node', tag: '20-alpine' };
};

export const getDefaultPort = (runtime?: string | null): number =>
    has(DEFAULT_PORTS, runtime) ? DEFAULT_PORTS[runtime as Runtime] : 3000;
