import { describe, expect, it } from 'vitest';
import { unwrap } from '@/shared/api/unwrap';

describe('unwrap', () => {
    it('returns the payload data when there is no meta', () => {
        expect(unwrap({ data: { id: 1, title: 'Note' } })).toEqual({ id: 1, title: 'Note' });
    });

    it('returns a page when meta is present', () => {
        const meta = { total: 84, limit: 30, offset: 0 };

        expect(unwrap({ data: [{ id: 1 }], meta })).toEqual({ items: [{ id: 1 }], meta });
    });

    it('returns undefined for an empty body', () => {
        expect(unwrap(undefined)).toBeUndefined();
    });

    it('keeps returning data when meta lives inside the payload data', () => {
        const data = { meta: { total: 1, limit: 1, offset: 0 } };

        expect(unwrap({ data })).toEqual(data);
    });

    it('preserves an empty page instead of collapsing it', () => {
        const meta = { total: 0, limit: 30, offset: 0 };

        expect(unwrap({ data: [], meta })).toEqual({ items: [], meta });
    });
});
