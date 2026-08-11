import { describe, expect, it } from 'vitest';
import { pageNavigation } from '@/shared/utils/pagination';

describe('pageNavigation', () => {
    it('describes the first page of several', () => {
        expect(pageNavigation({ total: 84, limit: 30, offset: 0 })).toEqual({
            page: 1,
            pageCount: 3,
            from: 1,
            to: 30,
            hasPrevious: false,
            hasNext: true
        });
    });

    it('describes the last partial page', () => {
        expect(pageNavigation({ total: 84, limit: 30, offset: 60 })).toEqual({
            page: 3,
            pageCount: 3,
            from: 61,
            to: 84,
            hasPrevious: true,
            hasNext: false
        });
    });

    it('describes a single full page', () => {
        expect(pageNavigation({ total: 30, limit: 30, offset: 0 })).toEqual({
            page: 1,
            pageCount: 1,
            from: 1,
            to: 30,
            hasPrevious: false,
            hasNext: false
        });
    });

    it('reports no range for an empty result', () => {
        expect(pageNavigation({ total: 0, limit: 30, offset: 0 })).toEqual({
            page: 1,
            pageCount: 0,
            from: 0,
            to: 0,
            hasPrevious: false,
            hasNext: false
        });
    });

    it('handles an offset that does not align to the limit', () => {
        expect(pageNavigation({ total: 3, limit: 2, offset: 1 })).toEqual({
            page: 1,
            pageCount: 2,
            from: 2,
            to: 3,
            hasPrevious: true,
            hasNext: false
        });
    });
});
