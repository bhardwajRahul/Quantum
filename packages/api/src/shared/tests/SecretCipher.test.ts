import { describe, expect, it } from 'vitest';
import SecretCipher from '@/shared/services/SecretCipher';

describe('SecretCipher', () => {
    const cipher = new SecretCipher();

    it('round-trips a secret', () => {
        const payload = cipher.encrypt('sk-super-secret');

        expect(payload).not.toContain('sk-super-secret');
        expect(cipher.decrypt(payload)).toBe('sk-super-secret');
    });

    it('produces a different ciphertext per call', () => {
        expect(cipher.encrypt('same')).not.toBe(cipher.encrypt('same'));
    });

    it('rejects an empty plaintext', () => {
        expect(() => cipher.encrypt('')).toThrowError('Crypto::EncryptFailed');
    });

    it('rejects a tampered payload', () => {
        const payload = cipher.encrypt('secret');
        const [iv, tag, data] = payload.split(':');
        const flipped = data.startsWith('0') ? `1${data.slice(1)}` : `0${data.slice(1)}`;

        expect(() => cipher.decrypt(`${iv}:${tag}:${flipped}`)).toThrowError('Crypto::DecryptFailed');
    });

    it('rejects a malformed payload', () => {
        expect(() => cipher.decrypt('not-a-payload')).toThrowError('Crypto::DecryptFailed');
    });
});
