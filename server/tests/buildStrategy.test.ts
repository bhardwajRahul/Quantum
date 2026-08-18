import { describe, it, expect } from 'vitest';
import { resolveStrategy } from '@services/build';
import { detectBuildStrategy } from '@services/runtime/detect';
import { IRepository } from '@typings/models/repository';

const repo = (over: Partial<IRepository> = {}): IRepository => over as IRepository;

describe('detectBuildStrategy', () => {
    it('detects dockerfile when a Dockerfile is present', () => {
        expect(detectBuildStrategy(['Dockerfile', 'package.json'])).toBe('dockerfile');
    });

    it('falls back to exec for compose files until the compose builder is implemented', () => {

        expect(detectBuildStrategy(['docker-compose.yml'])).toBe('exec');
        expect(detectBuildStrategy(['compose.yaml'])).toBe('exec');
    });

    it('falls back to exec when nothing buildable is detected', () => {
        expect(detectBuildStrategy(['package.json', 'index.js'])).toBe('exec');
        expect(detectBuildStrategy([])).toBe('exec');
    });

    it('prefers Dockerfile over compose when both present', () => {
        expect(detectBuildStrategy(['Dockerfile', 'docker-compose.yml'])).toBe('dockerfile');
    });
});

describe('resolveStrategy', () => {
    it('honors an explicit pinned strategy over detection', () => {
        expect(resolveStrategy(repo({ buildStrategy: 'dockerfile' }), [])).toBe('dockerfile');
        expect(resolveStrategy(repo({ buildStrategy: 'prebuilt-image' }), ['Dockerfile'])).toBe('prebuilt-image');
        expect(resolveStrategy(repo({ buildStrategy: 'exec' }), ['Dockerfile'])).toBe('exec');
    });

    it('auto-detects dockerfile when files include a Dockerfile', () => {
        expect(resolveStrategy(repo({ buildStrategy: 'auto' }), ['Dockerfile'])).toBe('dockerfile');
    });

    it('auto picks prebuilt-image when repo.image set and nothing compilable detected', () => {
        expect(resolveStrategy(repo({ buildStrategy: 'auto', image: 'nginx:1.27' }), [])).toBe('prebuilt-image');
    });

    it('auto falls back to exec when no Dockerfile and no image', () => {
        expect(resolveStrategy(repo({ buildStrategy: 'auto' }), ['package.json'])).toBe('exec');
    });

    it('treats an unset buildStrategy as needing detection (not a pinned value)', () => {

        expect(resolveStrategy(repo({}), ['Dockerfile'])).toBe('dockerfile');
    });

    it('a Dockerfile in the source wins over a configured prebuilt image under auto', () => {
        expect(resolveStrategy(repo({ buildStrategy: 'auto', image: 'nginx:1.27' }), ['Dockerfile'])).toBe('dockerfile');
    });
});
