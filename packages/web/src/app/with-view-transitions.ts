import { matchRoutes } from 'react-router-dom';
import type { createBrowserRouter, RouteObject, RouterNavigateOptions, To } from 'react-router-dom';

type DataRouter = ReturnType<typeof createBrowserRouter>;

const pathnameOf = (to: To): string => {
    if(typeof to !== 'string') return to.pathname ?? '';

    return to.replace(/[?#].*$/, '');
};

const layoutOf = (routes: RouteObject[], pathname: string): string | null => {
    if(!pathname.startsWith('/')) return null;

    const matches = matchRoutes(routes, pathname);
    if(matches === null) return null;

    const layouts = matches.slice(0, -1).filter((match) => match.route.path !== undefined);

    return layouts.at(-1)?.pathnameBase ?? null;
};

export const staysWithinLayout = (routes: RouteObject[], from: string, to: To | null): boolean => {
    if(to === null) return false;

    const target = layoutOf(routes, pathnameOf(to));
    if(target === null) return false;

    return target === layoutOf(routes, from);
};

export const withViewTransitions = (router: DataRouter): DataRouter => {
    const navigate = router.navigate.bind(router);

    router.navigate = (to: To | number | null, opts?: RouterNavigateOptions): Promise<void> => {
        if(typeof to === 'number') return navigate(to);

        const merged = { ...opts } as RouterNavigateOptions;
        if(merged.viewTransition === undefined){
            merged.viewTransition = !staysWithinLayout(
                router.routes as RouteObject[],
                router.state.location.pathname,
                to
            );
        }

        return navigate(to, merged);
    };

    return router;
};
