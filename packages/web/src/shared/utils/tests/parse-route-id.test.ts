import { describe, expect, it } from 'vitest';
import { parseRouteId } from '@/shared/utils/routing/parse-route-id';

describe('parseRouteId', () => {
    it('accepts a positive integer', () => {
        expect(parseRouteId('7')).toBe(7);
    });

    it('refuses anything that is not a bare positive integer', () => {
        for(const raw of ['abc', '', '-1', '0', '1.5', '1e3', ' 7', '7 ', '07x', undefined]){
            expect(parseRouteId(raw)).toBeUndefined();
        }
    });

    it('refuses a number too large to be an id', () => {
        expect(parseRouteId('9'.repeat(30))).toBeUndefined();
    });

    it('returns undefined rather than null so an idle query needs no conversion', () => {
        expect(parseRouteId('nope')).toBeUndefined();
        expect(parseRouteId('nope')).not.toBeNull();
    });
});
