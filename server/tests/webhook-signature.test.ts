import { describe, it, expect } from 'vitest';
import crypto from 'crypto';

const SECRET = 'test-webhook-secret';

const sign = (body: Buffer, secret: string): string =>
    'sha256=' + crypto.createHmac('sha256', secret).update(body).digest('hex');

const verify = (signature: string | undefined, rawBody: Buffer | undefined, secret: string): boolean => {
    if(!signature || !rawBody) return false;
    const expected = sign(rawBody, secret);
    const received = Buffer.from(signature);
    const computed = Buffer.from(expected);
    return received.length === computed.length && crypto.timingSafeEqual(received, computed);
};

describe('webhook signature verification', () => {
    const body = Buffer.from(JSON.stringify({ pusher: { name: 'x' }, ref: 'refs/heads/main' }));

    it('accepts a correctly signed payload', () => {
        expect(verify(sign(body, SECRET), body, SECRET)).toBe(true);
    });

    it('rejects a payload signed with the wrong secret', () => {
        expect(verify(sign(body, 'wrong-secret'), body, SECRET)).toBe(false);
    });

    it('rejects a tampered body', () => {
        const goodSig = sign(body, SECRET);
        const tampered = Buffer.from(JSON.stringify({ pusher: { name: 'attacker' } }));
        expect(verify(goodSig, tampered, SECRET)).toBe(false);
    });

    it('rejects a missing signature or body', () => {
        expect(verify(undefined, body, SECRET)).toBe(false);
        expect(verify(sign(body, SECRET), undefined, SECRET)).toBe(false);
    });
});
