import type { PageLoader } from '@/shared/contracts/routing/route';

const loaders = new Map<string, PageLoader[]>();
const requested = new Set<string>();

export const registerRouteLoader = (path: string, load: PageLoader) => {
    const registered = loaders.get(path);

    if(registered) registered.push(load);
    else loaders.set(path, [load]);
};

export const prefetchRoute = (path: string) => {
    if(requested.has(path)) return;

    const pending = loaders.get(path);
    if(!pending) return;

    requested.add(path);
    void Promise.all(pending.map((load) => load())).catch(() => requested.delete(path));
};
