import { describe, expect, it } from 'vitest';
import { router } from '@/app/router';
import type { RouteObject } from 'react-router-dom';

const flatten = (routes: RouteObject[]): RouteObject[] =>
    routes.flatMap((route) => [route, ...flatten(route.children ?? [])]);

const assembled = (): RouteObject[] => flatten(router.routes as RouteObject[]);

describe('the organization-gated layout routes', () => {
    it('nests the settings pages under the settings layout', () => {
        const settings = assembled().find((route) => route.path === 'settings');
        const children = (settings?.children ?? []).map((child) => child.path);

        expect(settings).toBeDefined();
        expect(children).toEqual(['organization', 'team']);
    });

    it('wraps the dashboard page in a layout route', () => {
        const dashboard = assembled().find((route) => route.path === 'dashboard');

        expect(dashboard?.children).toHaveLength(1);
        expect(dashboard?.children?.[0]).toMatchObject({ index: true });
    });

    it('keeps the account page out of the organization layouts', () => {
        const account = assembled().find((route) => route.path === 'account');
        const settings = assembled().find((route) => route.path === 'settings');
        const dashboard = assembled().find((route) => route.path === 'dashboard');

        expect(account).toBeDefined();
        expect(settings?.children?.some((child) => child.path === 'account')).toBe(false);
        expect(dashboard?.children?.some((child) => child.path === 'account')).toBe(false);
    });
});
