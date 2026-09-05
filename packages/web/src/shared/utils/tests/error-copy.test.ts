import { describe, expect, it } from 'vitest';
import { errorCopy } from '@/shared/utils/error-copy';

const copy = errorCopy({ 'Database::NotFound': 'That database no longer exists.' });

describe('errorCopy', () => {
    it('returns the message for an exact code match', () => {
        expect(copy('Database::NotFound')).toBe('That database no longer exists.');
        expect(copy(new Error('Database::NotFound'))).toBe('That database no longer exists.');
    });

    it('strips the detail suffix before lookup', () => {
        expect(copy('Database::NotFound:Project')).toBe('That database no longer exists.');
        expect(copy(new Error('Database::NotFound:ConnectionString'))).toBe('That database no longer exists.');
    });

    it('falls back for unknown codes and returns null for undefined', () => {
        expect(copy('Database::Exploded')).toBe('Something went wrong');
        expect(copy(new Error('Failed to fetch'))).toBe('Something went wrong');
        expect(copy(undefined)).toBe(null);
    });
});
