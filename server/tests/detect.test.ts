import { describe, it, expect } from 'vitest';
import { detectPreset } from '@services/runtime/detect';

describe('detectPreset', () => {
    it('detects Next.js from dependencies', () => {
        const p = detectPreset([], { dependencies: { next: '14.0.0' } });
        expect(p.framework).toBe('Next.js');
        expect(p.runtime).toBe('node');
        expect(p.startCommand).toBe('npm run start');
    });

    it('detects Vite as a node preset', () => {
        const p = detectPreset([], { devDependencies: { vite: '5.0.0' } });
        expect(p.framework).toBe('Vite');
        expect(p.runtime).toBe('node');
    });

    it('falls back to generic Node when package.json present but unknown', () => {
        const p = detectPreset([], { dependencies: { express: '4' }, scripts: { build: 'tsc' } });
        expect(p.runtime).toBe('node');
        expect(p.buildCommand).toBe('npm run build');
    });

    it('detects Python from requirements.txt', () => {
        const p = detectPreset(['requirements.txt', 'app.py']);
        expect(p.runtime).toBe('python');
        expect(p.installCommand).toContain('pip install');
    });

    it('detects Go from go.mod', () => {
        const p = detectPreset(['go.mod', 'main.go']);
        expect(p.runtime).toBe('go');
        expect(p.startCommand).toBe('./app');
    });

    it('detects a static site from index.html', () => {
        const p = detectPreset(['index.html']);
        expect(p.runtime).toBe('static');
        expect(p.port).toBe(80);
    });

    it('defaults to Node when nothing matches', () => {
        const p = detectPreset([]);
        expect(p.runtime).toBe('node');
    });
});
