import type { PageLoader } from '@/shared/contracts/routing/route';

const loaders = new Map<string, PageLoader[]>();

export const registerRouteLoader = (path: string, load: PageLoader) => {
    const registered = loaders.get(path);

    if(registered) registered.push(load);
    else loaders.set(path, [load]);
};
