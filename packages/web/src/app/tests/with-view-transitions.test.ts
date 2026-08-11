import { describe, expect, it } from 'vitest';
import { router } from '@/app/router';
import { staysWithinLayout } from '@/app/with-view-transitions';
import type { RouteObject } from 'react-router-dom';

const routes = (): RouteObject[] => router.routes as RouteObject[];

const stays = (from: string, to: string): boolean => staysWithinLayout(routes(), from, to);

/**
 * Every page of this skeleton sits directly under the dashboard chrome, which is pathless, so no
 * two locations share a layout and every navigation earns its transition. These pin that down;
 * once a pathful layout lands, the pair inside it must flip to `true`.
 */
describe('staysWithinLayout', () => {
    it('transitions between pages that only share the dashboard chrome', () => {
        expect(stays('/dashboard', '/applications')).toBe(false);
        expect(stays('/applications', '/settings/organization')).toBe(false);
    });

    it('reads past a query string and a hash on the target', () => {
        expect(stays('/dashboard', '/applications?tab=1')).toBe(false);
        expect(stays('/dashboard', '/applications#top')).toBe(false);
    });

    it('accepts the object form of a target', () => {
        expect(staysWithinLayout(routes(), '/dashboard', { pathname: '/applications' })).toBe(false);
    });

    it('transitions when there is no target to compare', () => {
        expect(staysWithinLayout(routes(), '/dashboard', null)).toBe(false);
    });

    it('ignores a target that is not an absolute path', () => {
        expect(staysWithinLayout(routes(), '/dashboard', 'applications')).toBe(false);
    });
});
