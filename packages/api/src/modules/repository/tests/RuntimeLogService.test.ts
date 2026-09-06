import { describe, expect, it } from 'vitest';
import { stripFrameHeaders } from '@/modules/repository/services/RuntimeLogService';

const framed = (stream: 1 | 2, text: string): Buffer => {
    const payload = Buffer.from(text, 'utf8');
    const header = Buffer.alloc(8);
    header[0] = stream;
    header.writeUInt32BE(payload.length, 4);
    return Buffer.concat([header, payload]);
};

describe('stripFrameHeaders', () => {
    it('passes raw output straight through', () => {
        expect(stripFrameHeaders(Buffer.from('listening on 4173\n', 'utf8'))).toBe('listening on 4173\n');
    });

    it('unwraps a multiplexed stdout frame', () => {
        expect(stripFrameHeaders(framed(1, 'ready\n'))).toBe('ready\n');
    });

    it('keeps stderr, so a crash is readable and not silently dropped', () => {
        expect(stripFrameHeaders(framed(2, 'EADDRINUSE\n'))).toBe('EADDRINUSE\n');
    });

    it('handles several frames arriving in one chunk', () => {
        const chunk = Buffer.concat([framed(1, 'first\n'), framed(2, 'second\n'), framed(1, 'third\n')]);

        expect(stripFrameHeaders(chunk)).toBe('first\nsecond\nthird\n');
    });

    it('does not treat ordinary text as a header', () => {
        expect(stripFrameHeaders(Buffer.from('> node index.js\n', 'utf8'))).toBe('> node index.js\n');
    });
});
