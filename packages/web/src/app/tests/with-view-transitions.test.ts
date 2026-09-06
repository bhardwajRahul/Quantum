import { describe, expect, it } from 'vitest';
import { router } from '@/app/router';
import { staysWithinLayout } from '@/app/with-view-transitions';
import type { RouteObject } from 'react-router-dom';

const routes = (): RouteObject[] => router.routes as RouteObject[];

const stays = (from: string, to: string): boolean => staysWithinLayout(routes(), from, to);

describe('staysWithinLayout', () => {
    it('transitions between pages that only share the dashboard chrome', () => {
        expect(stays('/projects', '/applications')).toBe(false);
        expect(stays('/applications', '/settings/organization')).toBe(false);
    });

    it('reads past a query string and a hash on the target', () => {
        expect(stays('/projects', '/applications?tab=1')).toBe(false);
        expect(stays('/projects', '/applications#top')).toBe(false);
    });

    it('accepts the object form of a target', () => {
        expect(staysWithinLayout(routes(), '/projects', { pathname: '/applications' })).toBe(false);
    });

    it('transitions when there is no target to compare', () => {
        expect(staysWithinLayout(routes(), '/projects', null)).toBe(false);
    });

    it('ignores a target that is not an absolute path', () => {
        expect(staysWithinLayout(routes(), '/projects', 'applications')).toBe(false);
    });
});
