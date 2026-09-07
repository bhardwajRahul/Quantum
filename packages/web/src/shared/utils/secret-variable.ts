const SECRET_NAME = /(KEY|PASSWORD|SECRET|TOKEN)/i;

export const isSecretVariable = (name: string): boolean => SECRET_NAME.test(name);

export const generateSecret = (bytes = 32): string =>
    Array.from(crypto.getRandomValues(new Uint8Array(bytes)), (byte) => byte.toString(16).padStart(2, '0')).join('');
