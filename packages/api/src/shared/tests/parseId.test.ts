import { describe, expect, it } from 'vitest';
import { parseId } from '@/shared/controllers/parseId';
import RuntimeError from '@/shared/errors/RuntimeError';

describe('parseId', () => {
    it('parses a positive integer string', () => {
        expect(parseId('42')).toBe(42);
    });

    it.each(['0', '-1', '1.5', 'abc', '', undefined, null])('rejects %o', (raw) => {
        try{
            parseId(raw);
            expect.unreachable('parseId should have thrown');
        }catch(error){
            expect(error).toBeInstanceOf(RuntimeError);
            expect((error as RuntimeError).message).toBe('Request::InvalidId');
            expect((error as RuntimeError).statusCode).toBe(400);
        }
    });
});
