import { describe, expect, it } from 'vitest';
import { sectionFor } from '@/app/navigation/sections';

describe('sectionFor', () => {
    it('matches a section on its own page and on its children', () => {
        expect(sectionFor('/dashboard')?.label).toBe('Dashboard');
        expect(sectionFor('/applications')?.label).toBe('Applications');
        expect(sectionFor('/applications/6')?.label).toBe('Applications');
        expect(sectionFor('/settings/organization')?.label).toBe('Settings');
    });

    it('leaves the pages without a section alone', () => {
        expect(sectionFor('/')).toBeNull();
        expect(sectionFor('/account')).toBeNull();
        expect(sectionFor('/sign-in')).toBeNull();
    });

    it('matches by segment, not by prefix', () => {
        expect(sectionFor('/dashboards')).toBeNull();
        expect(sectionFor('/analytics')).toBeNull();
    });

    it('keeps the settings section on its nested pages', () => {
        expect(sectionFor('/settings/organization')?.to).toBe('/settings/organization');
    });
});
