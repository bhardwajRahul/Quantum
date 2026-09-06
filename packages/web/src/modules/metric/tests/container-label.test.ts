import { describe, expect, it } from 'vitest';
import { containerLabel } from '@/modules/metric/utils/container-label';

describe('containerLabel', () => {
    it('names a stack service after its stack', () => {
        expect(containerLabel({ containerId: 4, kind: 'stack', app: 'pollium', service: 'gateway' })).toBe('pollium · gateway');
    });

    it('names a single-container application by itself', () => {
        expect(containerLabel({ containerId: 2, kind: 'database', app: 'main-db', service: null })).toBe('main-db');
    });
});
