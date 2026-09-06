import { describe, expect, it } from 'vitest';
import { normalizeVolumes } from '../services/repositoryVolumes';

describe('repository volumes', () => {
    it('keeps absolute container paths, trimmed, without trailing slashes or duplicates', () => {
        expect(normalizeVolumes([' /var/lib/app/uploads/ ', '/data', '/data'])).toEqual(['/var/lib/app/uploads', '/data']);
        expect(normalizeVolumes([])).toEqual([]);
    });

    it('refuses relative paths, parent segments, the root and the checkout mount', () => {
        for(const bad of ['data', './data', '/var/../etc', '/', '/app', '/app/']){
            expect(() => normalizeVolumes([bad])).toThrow('Repository::InvalidVolume');
        }
        expect(() => normalizeVolumes(['/app/uploads'])).not.toThrow();
    });
});
