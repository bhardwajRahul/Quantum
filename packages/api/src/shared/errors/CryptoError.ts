import { defineErrors } from '@/shared/errors/defineErrors';

export const CryptoError = defineErrors({
    domain: 'Crypto',
    causes: {
        EncryptFailed: 400,
        DecryptFailed: 500
    }
});
