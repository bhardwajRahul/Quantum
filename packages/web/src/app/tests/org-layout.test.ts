import { describe, expect, it } from 'vitest';
import { router } from '@/app/router';
import type { RouteObject } from 'react-router-dom';

const flatten = (routes: RouteObject[]): RouteObject[] =>
    routes.flatMap((route) => [route, ...flatten(route.children ?? [])]);

const assembled = (): RouteObject[] => flatten(router.routes as RouteObject[]);

const pathsOf = (routes: RouteObject[]): (string | undefined)[] => routes.map((route) => route.path);

const orgLayout = (): RouteObject | undefined =>
    assembled().find((route) =>
        route.path === undefined
        && (route.children ?? []).some((child) => child.path === 'applications')
    );

describe('the organization-gated layout routes', () => {
    it('wraps every protected page in a single shared layout', () => {
        const layout = orgLayout();

        expect(layout).toBeDefined();
        expect(pathsOf(layout?.children ?? [])).toEqual(expect.arrayContaining([
            'applications',
            'account',
            'settings/organization',
            'settings/team'
        ]));
    });

    it('keeps the guest pages out of the organization layout', () => {
        expect(pathsOf(orgLayout()?.children ?? [])).not.toContain('sign-in');
        expect(pathsOf(orgLayout()?.children ?? [])).not.toContain('sign-up');
    });

    it('keeps a catch-all for unknown paths', () => {
        expect(pathsOf(assembled())).toContain('*');
    });
});
