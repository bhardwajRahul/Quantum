import { describe, it, expect, beforeAll } from 'vitest';
import crypto from 'crypto';

const KEY_HEX = 'a'.repeat(64);
const IV_HEX = 'b'.repeat(32);

let encrypt: (t: string) => string;
let decrypt: (p: string) => string;

beforeAll(async () => {
    process.env.ENCRYPTION_KEY = KEY_HEX;
    process.env.ENCRYPTION_IV = IV_HEX;
    const mod = await import('@utilities/encryption');
    encrypt = mod.encrypt;
    decrypt = mod.decrypt;
});

describe('encryption (AES-256-GCM with legacy CBC back-compat)', () => {
    it('round-trips a value through GCM', () => {
        const secret = 'super-secret-token-123';
        const enc = encrypt(secret);
        expect(enc.startsWith('gcm:')).toBe(true);
        expect(decrypt(enc)).toBe(secret);
    });

    it('produces a unique nonce per call (no deterministic ciphertext)', () => {
        const a = encrypt('same-input');
        const b = encrypt('same-input');
        expect(a).not.toBe(b);
        expect(decrypt(a)).toBe('same-input');
        expect(decrypt(b)).toBe('same-input');
    });

    it('still decrypts legacy CBC with a per-value IV ("<ivHex>:<cipherHex>")', () => {
        const key = Buffer.from(KEY_HEX, 'hex');
        const iv = crypto.randomBytes(16);
        const cipher = crypto.createCipheriv('aes-256-cbc', key, iv);
        const data = cipher.update('legacy-per-iv', 'utf8', 'hex') + cipher.final('hex');
        const legacy = `${iv.toString('hex')}:${data}`;
        expect(decrypt(legacy)).toBe('legacy-per-iv');
    });

    it('still decrypts legacy CBC with the fixed IV (no ":" separator)', () => {
        const key = Buffer.from(KEY_HEX, 'hex');
        const iv = Buffer.from(IV_HEX, 'hex');
        const cipher = crypto.createCipheriv('aes-256-cbc', key, iv);
        const data = cipher.update('legacy-fixed-iv', 'utf8', 'hex') + cipher.final('hex');
        expect(decrypt(data)).toBe('legacy-fixed-iv');
    });

    it('rejects a tampered GCM auth tag', () => {
        const enc = encrypt('integrity-protected');
        const parts = enc.split(':');
        const tag = Buffer.from(parts[2], 'hex');
        tag[0] = tag[0] ^ 0xff;
        parts[2] = tag.toString('hex');
        expect(() => decrypt(parts.join(':'))).toThrow();
    });
});
