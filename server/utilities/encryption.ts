import crypto from 'crypto';

const ENCRYPTION_KEY = Buffer.from(process.env.ENCRYPTION_KEY || '', 'hex');

const LEGACY_IV = Buffer.from(process.env.ENCRYPTION_IV || '', 'hex');

if(ENCRYPTION_KEY.length !== 32){
    throw new Error(
        'ENCRYPTION_KEY must be a 64-character hex string (32 bytes for AES-256). ' +
        `Got ${ENCRYPTION_KEY.length} bytes. Set ENCRYPTION_KEY to a 64-char hex value.`
    );
}

export const encrypt = (text: string): string => {
    const iv = crypto.randomBytes(12);
    const cipher = crypto.createCipheriv('aes-256-gcm', ENCRYPTION_KEY, iv);
    const encrypted = Buffer.concat([cipher.update(text, 'utf8'), cipher.final()]);
    const authTag = cipher.getAuthTag();
    return `gcm:${iv.toString('hex')}:${authTag.toString('hex')}:${encrypted.toString('hex')}`;
};

export const decrypt = (payload: string): string => {

    if(payload.startsWith('gcm:')){
        const [, ivHex, tagHex, dataHex] = payload.split(':');
        const iv = Buffer.from(ivHex, 'hex');
        const decipher = crypto.createDecipheriv('aes-256-gcm', ENCRYPTION_KEY, iv);
        decipher.setAuthTag(Buffer.from(tagHex, 'hex'));
        return decipher.update(Buffer.from(dataHex, 'hex')).toString('utf8') + decipher.final('utf8');
    }

    const hasIV = payload.includes(':');
    const iv = hasIV ? Buffer.from(payload.split(':')[0], 'hex') : LEGACY_IV;
    const data = hasIV ? payload.slice(payload.indexOf(':') + 1) : payload;
    const decipher = crypto.createDecipheriv('aes-256-cbc', ENCRYPTION_KEY, iv);
    return decipher.update(data, 'hex', 'utf8') + decipher.final('utf8');
};

export const encryptEnvMap = (map: Map<string, string> | Iterable<[string, string]>): Map<string, string> => {
    const out = new Map<string, string>();
    for(const [key, value] of map){
        out.set(key, encrypt(value));
    }
    return out;
};

export const decryptEnvMap = (map: Map<string, string> | Iterable<[string, string]>): Map<string, string> => {
    const out = new Map<string, string>();
    for(const [key, value] of map){
        out.set(key, decrypt(value));
    }
    return out;
};
