process.env.ENCRYPTION_KEY = process.env.ENCRYPTION_KEY || 'a'.repeat(64);
process.env.ENCRYPTION_IV = process.env.ENCRYPTION_IV || 'b'.repeat(32);
process.env.SECRET_KEY = process.env.SECRET_KEY || 'test-secret-key';
process.env.NODE_ENV = process.env.NODE_ENV || 'test';
