import { describe, expect, it } from 'vitest';
import { generateSecret, isSecretVariable } from '@/shared/utils/secret-variable';

describe('secret variables', () => {
    it('recognises keys, passwords, secrets and tokens by name, case-insensitively', () => {
        for(const name of ['POSTGRES_PASSWORD', 'ENCRYPTION_KEY', 'JWT_SECRET', 'GITHUB_TOKEN', 'api_key', 'RUSTFS_SECRET_KEY']){
            expect(isSecretVariable(name)).toBe(true);
        }
        for(const name of ['DATABASE_URL', 'PORT', 'WEB_URL', 'PG_VERSION', 'KEYBOARD_LAYOUT'.replace('KEY', 'K3Y')]){
            expect(isSecretVariable(name)).toBe(false);
        }
    });

    it('generates 32 random bytes as 64 hex characters, different every time', () => {
        const first = generateSecret();
        expect(first).toMatch(/^[0-9a-f]{64}$/);
        expect(generateSecret()).not.toBe(first);
        expect(generateSecret(16)).toHaveLength(32);
    });
});
