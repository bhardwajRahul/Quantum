import { describe, expect, it } from 'vitest';
import { panelFor } from '@/app/navigation/panels';

describe('panelFor', () => {
    it('swaps the panel for the settings surfaces', () => {
        expect(panelFor('/settings')).toBe('settings');
        expect(panelFor('/settings/organization')).toBe('settings');
        expect(panelFor('/settings/billing')).toBe('settings');
    });

    it('keeps the app panel everywhere you are using the app', () => {
        expect(panelFor('/')).toBe('app');
        expect(panelFor('/dashboard')).toBe('app');
        expect(panelFor('/applications')).toBe('app');
        expect(panelFor('/applications/6')).toBe('app');
        expect(panelFor('/codespaces/3/terminal')).toBe('app');
    });
});
